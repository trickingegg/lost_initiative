"""
WebSocket endpoint for streaming GM narrative.

Protocol (server → client):
  {"type": "chunk",            "text": "..."}   — narrative chunk
  {"type": "state_changes",    "data": {...}}   — after full response
  {"type": "suggested_actions","data": [...]}   — after full response
  {"type": "done"}                              — stream complete
  {"type": "error",            "message": "..."} — on failure
"""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/session/{session_id}/stream")
async def narrative_stream(session_id: str, websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            raw = await websocket.receive_text()
            payload = json.loads(raw)
            action = payload.get("action", "").strip()
            if not action:
                await websocket.send_text(
                    json.dumps({"type": "error", "message": "Empty action"})
                )
                continue
            await _handle_action(session_id, action, websocket)

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.error("WebSocket error for session %s: %s", session_id, exc)
        try:
            await websocket.send_text(
                json.dumps({"type": "error", "message": str(exc)})
            )
        except Exception:
            pass


async def _handle_action(session_id: str, action: str, websocket: WebSocket) -> None:
    from pydantic import ValidationError

    from app.ai_gm.context_manager import build_context_window
    from app.ai_gm.memory import add_memory_event, build_event_summary
    from app.ai_gm.providers.factory import get_provider
    from app.ai_gm.schemas import GMResponse as AIGMSchema
    from app.db import crud
    from app.db.session import AsyncSessionLocal
    from app.models.domain import ChatMessage, GMResponse as DomainGMResponse
    from app.services.session_service import apply_state_changes

    # Load session
    async with AsyncSessionLocal() as db:
        session = await crud.get_session(db, session_id)

    if session is None:
        await websocket.send_text(
            json.dumps({"type": "error", "message": "Session not found"})
        )
        return

    # Build prompt
    prompt = build_context_window(session)
    full_prompt = f"{prompt}\n\nPLAYER: {action}\n\nGM (JSON only):"

    # Stream chunks from provider
    full_text = ""
    try:
        provider = get_provider()
        async for chunk in provider.stream(full_prompt):
            full_text += chunk
            await websocket.send_text(json.dumps({"type": "chunk", "text": chunk}))
    except Exception as exc:
        logger.error("Provider streaming error: %s", exc)
        await websocket.send_text(
            json.dumps({"type": "error", "message": str(exc)})
        )
        return

    # Validate and persist
    try:
        cleaned = full_text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(l for l in lines if not l.strip().startswith("```"))

        data = json.loads(cleaned)
        schema = AIGMSchema.model_validate(data)

        await websocket.send_text(json.dumps({
            "type": "state_changes",
            "data": schema.state_changes.model_dump(),
        }))
        await websocket.send_text(json.dumps({
            "type": "suggested_actions",
            "data": schema.suggested_actions,
        }))

        domain_response = DomainGMResponse(
            narrative=schema.narrative,
            state_changes=schema.state_changes,
            internal_gm_notes=schema.internal_gm_notes,
            suggested_actions=schema.suggested_actions,
            image_prompt=schema.image_prompt,
            image_key=schema.image_key,
        )

        event = build_event_summary(
            changes=schema.state_changes,
            narrative=schema.narrative,
            turn=session.turn_count + 1,
            player_action=action,
        )
        updated = session
        if event:
            updated = add_memory_event(updated, event)
        updated = updated.model_copy(update={"gm_internal_notes": schema.internal_gm_notes})
        updated = apply_state_changes(updated, domain_response.state_changes)
        updated = updated.model_copy(update={
            "chat_history": list(session.chat_history) + [
                ChatMessage(role="player", content=action),
                ChatMessage(role="gm", content=schema.narrative),
            ]
        })

        async with AsyncSessionLocal() as db:
            await crud.update_session(db, updated, domain_response)

    except (json.JSONDecodeError, ValidationError, Exception) as exc:
        logger.warning("WS: response validation/persist failed: %s", exc)
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": f"Response validation failed: {exc}",
        }))

    await websocket.send_text(json.dumps({"type": "done"}))
