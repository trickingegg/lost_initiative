"""
AI Game Master service. Calls Gemini with structured output, validates the
response with Pydantic, retries on invalid JSON (up to 2 attempts).

Architecture principle: this module builds the prompt and calls the API.
It does NOT apply game state changes — that's session_service.py.
"""
from __future__ import annotations

import json
import logging
from typing import Optional

import google.generativeai as genai
from pydantic import ValidationError

from app.ai_gm.context_manager import build_context_window
from app.ai_gm.memory import (
    add_memory_event,
    build_event_summary,
)
from app.ai_gm.schemas import GMResponse as AIGMSchema
from app.config import settings
from app.models.domain import GameSession, GMResponse, StateChanges

logger = logging.getLogger(__name__)

_MAX_RETRIES = 2
_MODEL_NAME = "gemini-1.5-flash"

# Gemini client is initialised lazily so that tests without an API key can mock it
_client_initialized = False


def _ensure_client() -> None:
    global _client_initialized
    if not _client_initialized:
        if not settings.gemini_api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Add it to your .env file."
            )
        genai.configure(api_key=settings.gemini_api_key)
        _client_initialized = True


def _call_gemini(prompt: str) -> str:
    """Call Gemini and return raw text response."""
    _ensure_client()
    model = genai.GenerativeModel(
        model_name=_MODEL_NAME,
        generation_config=genai.GenerationConfig(
            temperature=0.9,
            response_mime_type="application/json",
        ),
    )
    response = model.generate_content(prompt)
    return response.text




def _parse_schema_response(raw: str) -> AIGMSchema:
    """Parse raw text into the AI schema type (for internal validation)."""
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(
            line for line in lines
            if not line.strip().startswith("```")
        )
    data = json.loads(text)
    return AIGMSchema.model_validate(data)


def _schema_to_domain(schema: AIGMSchema) -> GMResponse:
    """Convert the AI schema response to the domain GMResponse model."""
    return GMResponse(
        narrative=schema.narrative,
        state_changes=StateChanges(**schema.state_changes.model_dump()),
        image_prompt=schema.image_prompt,
        image_key=schema.image_key,
        internal_gm_notes=schema.internal_gm_notes,
        suggested_actions=schema.suggested_actions,
    )


def _fallback_response(reason: str) -> GMResponse:
    """Return a safe fallback when Gemini fails after all retries."""
    return GMResponse(
        narrative=(
            "The world holds its breath for a moment. "
            "Your Game Master is having trouble focusing right now — "
            "please try your action again."
        ),
        state_changes=StateChanges(),
        internal_gm_notes=f"[GM_SERVICE_ERROR] {reason}",
        suggested_actions=["Try again", "Wait", "Look around"],
    )


async def process_action(
    session: GameSession,
    player_action: str,
) -> tuple[GMResponse, GameSession]:
    """
    Main entry point. Builds context, calls Gemini, validates, applies memory.

    Returns:
        (gm_response, updated_session_with_new_memory_and_notes)
    """
    prompt = build_context_window(session)
    full_prompt = f"{prompt}\n\nPLAYER: {player_action}\n\nGM (JSON only):"

    last_error: Optional[str] = None
    retry_suffix = ""

    for attempt in range(_MAX_RETRIES):
        try:
            raw = _call_gemini(full_prompt + retry_suffix)
            schema_response = _parse_schema_response(raw)
            gm_response = _schema_to_domain(schema_response)

            # Success — record memory event if significant
            event = build_event_summary(
                changes=schema_response.state_changes,
                narrative=schema_response.narrative,
                turn=session.turn_count + 1,
                player_action=player_action,
            )
            updated_session = session
            if event is not None:
                updated_session = add_memory_event(session, event)

            # Store GM's internal notes for next turn
            updated_session = updated_session.model_copy(update={
                "gm_internal_notes": schema_response.internal_gm_notes,
            })

            return gm_response, updated_session

        except (json.JSONDecodeError, ValidationError) as exc:
            last_error = str(exc)
            logger.warning("Gemini response invalid (attempt %d): %s", attempt + 1, last_error)
            retry_suffix = (
                "\n\nIMPORTANT: Your previous response was not valid JSON. "
                "Respond ONLY with valid JSON matching the schema. No markdown, no extra text."
            )
        except Exception as exc:
            last_error = str(exc)
            logger.error("Gemini call failed (attempt %d): %s", attempt + 1, last_error)
            # Network / quota errors — no point retrying with a prompt fix
            break

    logger.error("All Gemini retries exhausted. Last error: %s", last_error)
    return _fallback_response(last_error or "unknown error"), session


async def process_roll_result(
    session: GameSession,
    roll: int,
) -> tuple[GMResponse, GameSession]:
    """
    Process the outcome of a player's die roll that the GM previously requested.
    Injects the roll result into the prompt so the GM can narrate consequences.
    """
    prompt = build_context_window(session)
    full_prompt = (
        f"{prompt}\n\n"
        f"SYSTEM: The player rolled a {roll} on the requested check.\n"
        f"GM (JSON only — narrate the outcome of this roll):"
    )

    last_error: Optional[str] = None
    retry_suffix = ""

    for attempt in range(_MAX_RETRIES):
        try:
            raw = _call_gemini(full_prompt + retry_suffix)
            schema_response = _parse_schema_response(raw)
            gm_response = _schema_to_domain(schema_response)

            event = build_event_summary(
                changes=schema_response.state_changes,
                narrative=schema_response.narrative,
                turn=session.turn_count + 1,
                player_action=f"[Roll result: {roll}]",
            )
            updated_session = session
            if event:
                updated_session = add_memory_event(session, event)
            updated_session = updated_session.model_copy(update={
                "gm_internal_notes": schema_response.internal_gm_notes,
            })
            return gm_response, updated_session

        except (json.JSONDecodeError, ValidationError) as exc:
            last_error = str(exc)
            logger.warning("Gemini roll response invalid (attempt %d): %s", attempt + 1, last_error)
            retry_suffix = (
                "\n\nIMPORTANT: Your previous response was not valid JSON. "
                "Respond ONLY with valid JSON matching the schema."
            )
        except Exception as exc:
            last_error = str(exc)
            logger.error("Gemini roll call failed (attempt %d): %s", attempt + 1, last_error)
            break

    return _fallback_response(last_error or "unknown error"), session
