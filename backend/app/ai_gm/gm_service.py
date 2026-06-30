"""
AI Game Master service.

Builds the context window → calls the configured AI provider → validates JSON
with Pydantic → retries on bad response (up to 2 attempts) → graceful fallback.

This module is provider-agnostic: it calls get_provider() which returns
whatever AIProvider is configured via AI_PROVIDER env var.
"""
from __future__ import annotations

import json
import logging
from typing import Optional

from pydantic import ValidationError

from app.ai_gm.context_manager import build_context_window
from app.ai_gm.memory import add_memory_event, build_event_summary
from app.ai_gm.providers.factory import get_provider
from app.ai_gm.schemas import GMResponse as AIGMSchema
from app.models.domain import GameSession, GMResponse, StateChanges

logger = logging.getLogger(__name__)

_MAX_RETRIES = 2


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _parse_schema_response(raw: str) -> AIGMSchema:
    """Parse raw text into the AI schema type. Strips markdown fences if needed."""
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(l for l in lines if not l.strip().startswith("```"))
    data = json.loads(text)
    return AIGMSchema.model_validate(data)


def _schema_to_domain(schema: AIGMSchema) -> GMResponse:
    """Convert the validated AI schema to the domain GMResponse model."""
    return GMResponse(
        narrative=schema.narrative,
        state_changes=StateChanges(**schema.state_changes.model_dump()),
        image_prompt=schema.image_prompt,
        image_key=schema.image_key,
        internal_gm_notes=schema.internal_gm_notes,
        suggested_actions=schema.suggested_actions,
    )


def _fallback_response(reason: str) -> GMResponse:
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


async def _call_provider(prompt: str) -> str:
    """Call the configured AI provider and return raw text."""
    provider = get_provider()
    return await provider.generate(prompt)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def process_action(
    session: GameSession,
    player_action: str,
) -> tuple[GMResponse, GameSession]:
    """
    Process a player action:
      1. Build context window
      2. Call AI provider (with retry on bad JSON)
      3. Apply memory + GM notes to session
      4. Return (domain GMResponse, updated session)
    """
    prompt = build_context_window(session)
    full_prompt = f"{prompt}\n\nPLAYER: {player_action}\n\nGM (JSON only):"

    last_error: Optional[str] = None
    retry_suffix = ""

    for attempt in range(_MAX_RETRIES):
        try:
            raw = await _call_provider(full_prompt + retry_suffix)
            schema = _parse_schema_response(raw)
            gm_response = _schema_to_domain(schema)

            updated_session = _update_session_after_response(
                session, schema, player_action
            )
            logger.debug("AI GM response OK (attempt=%d)", attempt + 1)
            return gm_response, updated_session

        except (json.JSONDecodeError, ValidationError) as exc:
            last_error = str(exc)
            logger.warning(
                "Bad JSON from provider (attempt %d/%d): %s",
                attempt + 1, _MAX_RETRIES, last_error,
            )
            retry_suffix = (
                "\n\nIMPORTANT: Your previous response was not valid JSON. "
                "Respond ONLY with valid JSON matching the schema. No markdown, no extra text."
            )
        except Exception as exc:
            last_error = str(exc)
            logger.error("Provider call failed (attempt %d): %s", attempt + 1, last_error)
            break  # network / auth errors — no point retrying with the same prompt

    logger.error("All provider retries exhausted. Last error: %s", last_error)
    return _fallback_response(last_error or "unknown error"), session


async def process_roll_result(
    session: GameSession,
    roll: int,
) -> tuple[GMResponse, GameSession]:
    """
    Narrate the outcome of a die roll the GM previously requested.
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
            raw = await _call_provider(full_prompt + retry_suffix)
            schema = _parse_schema_response(raw)
            gm_response = _schema_to_domain(schema)

            updated_session = _update_session_after_response(
                session, schema, f"[Roll result: {roll}]"
            )
            return gm_response, updated_session

        except (json.JSONDecodeError, ValidationError) as exc:
            last_error = str(exc)
            logger.warning("Bad JSON on roll (attempt %d): %s", attempt + 1, last_error)
            retry_suffix = (
                "\n\nIMPORTANT: Respond ONLY with valid JSON matching the schema."
            )
        except Exception as exc:
            last_error = str(exc)
            logger.error("Provider call failed on roll (attempt %d): %s", attempt + 1, last_error)
            break

    return _fallback_response(last_error or "unknown error"), session


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _update_session_after_response(
    session: GameSession,
    schema: AIGMSchema,
    player_action: str,
) -> GameSession:
    """Record memory event and store GM notes. Returns updated session."""
    event = build_event_summary(
        changes=schema.state_changes,
        narrative=schema.narrative,
        turn=session.turn_count + 1,
        player_action=player_action,
    )
    updated = session
    if event is not None:
        updated = add_memory_event(updated, event)
    return updated.model_copy(update={"gm_internal_notes": schema.internal_gm_notes})
