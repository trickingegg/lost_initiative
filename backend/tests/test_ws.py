"""
WebSocket protocol tests. Provider JSON must never be forwarded as chunks.
"""
import json
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.api.routes import ws as ws_module
from app.main import app
from app.models.domain import GMResponse, StateChanges
from tests.test_session_service import make_session


class TestNarrativeChunks:
    def test_splits_text(self):
        chunks = ws_module._narrative_chunks("abcdefghij", 4)
        assert chunks == ["abcd", "efgh", "ij"]
        assert "".join(chunks) == "abcdefghij"

    def test_empty_text_yields_one_empty_chunk(self):
        assert ws_module._narrative_chunks("") == [""]


def test_ws_streams_narrative_not_raw_json():
    session = make_session()
    narrative = "You enter a quiet stone hall lined with faded banners."
    gm = GMResponse(
        narrative=narrative,
        state_changes=StateChanges(),
        suggested_actions=["Look around"],
    )

    async def fake_get(db, sid):
        return session

    async def fake_update(db, sess, gm_response=None):
        return sess

    async def fake_process(sess, action):
        return gm, sess

    with patch("app.db.crud.get_session", new=AsyncMock(side_effect=fake_get)), patch(
        "app.db.crud.update_session", new=AsyncMock(side_effect=fake_update)
    ), patch("app.ai_gm.gm_service.process_action", new=AsyncMock(side_effect=fake_process)):
        with TestClient(app) as client:
            with client.websocket_connect(f"/ws/session/{session.id}/stream") as websocket:
                websocket.send_text(json.dumps({"action": "I look around."}))
                messages = []
                while True:
                    data = websocket.receive_json()
                    messages.append(data)
                    if data["type"] in ("done", "error"):
                        break

    types = [item["type"] for item in messages]
    assert "error" not in types
    assert types[0] == "chunk"
    assert types[-1] == "done"
    assert "state_changes" in types
    assert "suggested_actions" in types
    text = "".join(item["text"] for item in messages if item["type"] == "chunk")
    assert text == narrative
    for item in messages:
        if item["type"] == "chunk":
            assert not item["text"].lstrip().startswith("{")
            assert "await_roll" not in item["text"]
