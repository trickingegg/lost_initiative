"""
WebSocket endpoint for streaming GM narrative.

The provider JSON is accumulated silently. The client only receives the
already-validated `narrative` as `chunk` events — never raw JSON tokens.

Protocol (server → client):
  {"type": "chunk",            "text": "..."}   — narrative fragment
  {"type": "state_changes",    "data": {...}}   — after full response
  {"type": "suggested_actions","data": [...]}   — after full response
  {"type": "done"}                              — stream complete
  {"type": "error",            "message": "..."} — on failure
"""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.models.domain import ChatMessage

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

_CHUNK_SIZE = 32


def _narrative_chunks(text: str, size: int = _CHUNK_SIZE) -> list[str]:
    if not text:
        return [""]
    return [text[i:i + size] for i in range(0, len(text), size)]


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
    from app.ai_gm.gm_service import process_action
    from app.db import crud
    from app.db.session import AsyncSessionLocal
    from app.services.combat_flow import continue_combat
    from app.services.session_service import apply_state_changes

    async with AsyncSessionLocal() as db:
        session = await crud.get_session(db, session_id)

    if session is None:
        await websocket.send_text(
            json.dumps({"type": "error", "message": "Session not found"})
        )
        return

    gm_response, session_with_memory = await process_action(session, action)
    updated = apply_state_changes(session_with_memory, gm_response.state_changes)
    updated = updated.model_copy(update={
        "chat_history": list(session.chat_history) + [
            ChatMessage(role="player", content=action),
            ChatMessage(role="gm", content=gm_response.narrative),
        ]
    })
    updated, gm_response = await continue_combat(updated, gm_response)

    for piece in _narrative_chunks(gm_response.narrative):
        await websocket.send_text(json.dumps({"type": "chunk", "text": piece}))

    await websocket.send_text(json.dumps({
        "type": "state_changes",
        "data": gm_response.state_changes.model_dump(),
    }))
    await websocket.send_text(json.dumps({
        "type": "suggested_actions",
        "data": gm_response.suggested_actions,
    }))

    async with AsyncSessionLocal() as db:
        await crud.update_session(db, updated, gm_response)

    await websocket.send_text(json.dumps({"type": "done"}))
