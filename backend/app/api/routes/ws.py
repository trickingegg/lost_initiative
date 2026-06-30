"""
WebSocket endpoint for streaming GM narrative.
Stage 1: stub that echoes player messages.
Stage 2: will stream Gemini token-by-token via SSE-style chunks.
"""
from __future__ import annotations

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/session/{session_id}/stream")
async def narrative_stream(session_id: str, websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            action = payload.get("action", "")

            # Stage 1 stub — echo back a simple placeholder narrative
            chunks = [
                f"[Session {session_id}] ",
                "The GM receives your action: ",
                f'"{action}". ',
                "Full AI streaming will be available in Stage 2.",
            ]
            for chunk in chunks:
                await websocket.send_text(json.dumps({"type": "chunk", "text": chunk}))

            await websocket.send_text(json.dumps({"type": "done"}))

    except WebSocketDisconnect:
        pass
