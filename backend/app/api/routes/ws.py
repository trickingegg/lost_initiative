"""
WebSocket endpoint for streaming GM narrative token-by-token.

Protocol:
  Client → Server: {"action": "I look around the room."}
  Server → Client: {"type": "chunk", "text": "You step into..."}  (repeated)
  Server → Client: {"type": "state_changes", "data": {...}}        (once, before done)
  Server → Client: {"type": "suggested_actions", "data": [...]}    (once)
  Server → Client: {"type": "done"}
  Server → Client: {"type": "error", "message": "..."}             (on failure)

Gemini streaming is done via `stream=True` on `generate_content`.
Each candidate.text chunk is forwarded as soon as it arrives.
After the full response, Pydantic validates it; on failure sends {"type": "error"}.
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
                await websocket.send_text(json.dumps({"type": "error", "message": "Empty action"}))
                continue

            await _handle_action(session_id, action, websocket)

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.error("WebSocket error for session %s: %s", session_id, exc)
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": str(exc)}))
        except Exception:
            pass


async def _handle_action(session_id: str, action: str, websocket: WebSocket) -> None:
    """Fetch session, call Gemini with streaming, forward chunks."""
    from app.ai_gm.context_manager import build_context_window
    from app.ai_gm.schemas import GMResponse as AIGMResponse
    from app.config import settings

    # Lazy import to avoid initialising Gemini at module load
    try:
        import google.generativeai as genai
        from pydantic import ValidationError
    except ImportError as exc:
        await websocket.send_text(json.dumps({"type": "error", "message": str(exc)}))
        return

    # Load session from DB
    from app.db.session import AsyncSessionLocal
    from app.db import crud

    async with AsyncSessionLocal() as db:
        session = await crud.get_session(db, session_id)

    if session is None:
        await websocket.send_text(json.dumps({"type": "error", "message": "Session not found"}))
        return

    if not settings.gemini_api_key:
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": "GEMINI_API_KEY is not configured",
        }))
        return

    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        generation_config=genai.GenerationConfig(
            temperature=0.9,
            response_mime_type="application/json",
        ),
    )

    prompt = build_context_window(session)
    full_prompt = f"{prompt}\n\nPLAYER: {action}\n\nGM (JSON only):"

    # Stream response chunks
    full_text = ""
    try:
        response = model.generate_content(full_prompt, stream=True)
        for chunk in response:
            text = chunk.text
            if text:
                full_text += text
                await websocket.send_text(json.dumps({"type": "chunk", "text": text}))
    except Exception as exc:
        logger.error("Gemini streaming error: %s", exc)
        await websocket.send_text(json.dumps({"type": "error", "message": str(exc)}))
        return

    # Validate final JSON
    try:
        # Strip markdown fences if present
        cleaned = full_text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(l for l in lines if not l.strip().startswith("```"))
        data = json.loads(cleaned)
        gm_response = AIGMResponse.model_validate(data)

        await websocket.send_text(json.dumps({
            "type": "state_changes",
            "data": gm_response.state_changes.model_dump(),
        }))
        await websocket.send_text(json.dumps({
            "type": "suggested_actions",
            "data": gm_response.suggested_actions,
        }))

        # Persist session update
        from app.services.session_service import apply_state_changes
        from app.ai_gm.memory import build_event_summary, add_memory_event
        from app.models.domain import ChatMessage, GMResponse as DomainGMResponse

        domain_response = DomainGMResponse(
            narrative=gm_response.narrative,
            state_changes=gm_response.state_changes,
            internal_gm_notes=gm_response.internal_gm_notes,
            suggested_actions=gm_response.suggested_actions,
            image_prompt=gm_response.image_prompt,
            image_key=gm_response.image_key,
        )

        event = build_event_summary(
            changes=gm_response.state_changes,
            narrative=gm_response.narrative,
            turn=session.turn_count + 1,
            player_action=action,
        )
        updated_session = session
        if event:
            updated_session = add_memory_event(session, event)
        updated_session = updated_session.model_copy(update={
            "gm_internal_notes": gm_response.internal_gm_notes,
        })
        updated_session = apply_state_changes(updated_session, domain_response.state_changes)
        updated_session = updated_session.model_copy(update={
            "chat_history": list(session.chat_history) + [
                ChatMessage(role="player", content=action),
                ChatMessage(role="gm", content=gm_response.narrative),
            ]
        })

        async with AsyncSessionLocal() as db:
            await crud.update_session(db, updated_session, domain_response)

    except (json.JSONDecodeError, Exception) as exc:
        logger.warning("WebSocket: could not validate/persist GM response: %s", exc)
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": f"Response validation failed: {exc}",
        }))

    await websocket.send_text(json.dumps({"type": "done"}))
