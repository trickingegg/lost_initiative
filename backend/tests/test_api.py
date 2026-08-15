"""
Integration tests for the API layer.
Uses SQLite in-memory via HTTPX async client + FastAPI test app.
AI GM is always mocked — these tests must not call a live provider.
"""
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.db.session import Base, engine
from app.models.domain import GMResponse, StateChanges


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


def _gm(narrative: str = "The woods are still.", **changes) -> GMResponse:
    return GMResponse(narrative=narrative, state_changes=StateChanges(**changes))


def _patch_action(gm_response: GMResponse):
    async def fake(session, action):
        return gm_response, session

    return patch("app.ai_gm.gm_service.process_action", new=AsyncMock(side_effect=fake))


def _patch_roll(gm_response: GMResponse):
    async def fake(session, roll):
        return gm_response, session

    return patch("app.ai_gm.gm_service.process_roll_result", new=AsyncMock(side_effect=fake))


CHARACTER_PAYLOAD = {
    "id": "char-1",
    "name": "Aria",
    "race": "Elf",
    "char_class": "Wizard",
    "background": "Sage",
    "level": 3,
    "xp": 900,
    "hp_current": 18,
    "hp_max": 18,
    "ac": 12,
    "abilities": {
        "strength": 8,
        "dexterity": 14,
        "constitution": 12,
        "intelligence": 17,
        "wisdom": 12,
        "charisma": 10,
    },
}

SESSION_PAYLOAD = {
    "character": CHARACTER_PAYLOAD,
    "setting": "Dark Forest",
    "story_template": "dungeon_delve",
}


class TestHealthCheck:
    @pytest.mark.asyncio
    async def test_health(self, client: AsyncClient):
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_cors_defaults_include_vite_ports(self):
        from app.config import Settings

        origins = Settings().cors_origins_list
        assert "http://localhost:3000" in origins
        assert "http://127.0.0.1:3000" in origins
        assert "http://localhost:5173" in origins


class TestSessionLifecycle:
    @pytest.mark.asyncio
    async def test_create_session(self, client: AsyncClient):
        resp = await client.post("/api/session/start", json=SESSION_PAYLOAD)
        assert resp.status_code == 200
        data = resp.json()
        assert data["session"]["character"]["name"] == "Aria"
        assert data["session"]["story_template"] == "dungeon_delve"

    @pytest.mark.asyncio
    async def test_get_session(self, client: AsyncClient):
        create_resp = await client.post("/api/session/start", json=SESSION_PAYLOAD)
        session_id = create_resp.json()["session"]["id"]

        get_resp = await client.get(f"/api/session/{session_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["session"]["id"] == session_id

    @pytest.mark.asyncio
    async def test_get_session_not_found(self, client: AsyncClient):
        resp = await client.get("/api/session/nonexistent-id")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_player_action(self, client: AsyncClient):
        create_resp = await client.post("/api/session/start", json=SESSION_PAYLOAD)
        session_id = create_resp.json()["session"]["id"]

        with _patch_action(_gm("You look around the ruined hall.")):
            action_resp = await client.post(
                f"/api/session/{session_id}/action",
                json={"action": "I look around the room.", "session_id": session_id},
            )

        assert action_resp.status_code == 200
        data = action_resp.json()
        assert data["gm_response"]["narrative"] == "You look around the ruined hall."
        assert data["session"]["turn_count"] == 1
        assert data["session"]["id"] == session_id

    @pytest.mark.asyncio
    async def test_player_action_applies_xp_and_items(self, client: AsyncClient):
        create_resp = await client.post("/api/session/start", json=SESSION_PAYLOAD)
        session_id = create_resp.json()["session"]["id"]

        with _patch_action(_gm(
            "The goblin falls.",
            add_xp=200,
            add_items=[{"name": "Gold Pieces", "quantity": 12}],
        )):
            action_resp = await client.post(
                f"/api/session/{session_id}/action",
                json={"action": "I search the body.", "session_id": session_id},
            )

        assert action_resp.status_code == 200
        character = action_resp.json()["session"]["character"]
        assert character["xp"] == 1100
        assert character["inventory"][0]["name"] == "Gold Pieces"
        assert character["inventory"][0]["quantity"] == 12

        stored = await client.get(f"/api/session/{session_id}")
        assert stored.json()["session"]["character"]["xp"] == 1100

    @pytest.mark.asyncio
    async def test_player_action_start_battle_fills_turn_order(self, client: AsyncClient):
        create_resp = await client.post("/api/session/start", json=SESSION_PAYLOAD)
        session_id = create_resp.json()["session"]["id"]

        with _patch_action(_gm(
            "Goblins leap from the brush!",
            start_battle=[{"name": "Goblin", "hp": 7, "ac": 15, "initiative_bonus": 2, "cr": 0.25}],
        )):
            action_resp = await client.post(
                f"/api/session/{session_id}/action",
                json={"action": "I step into the clearing.", "session_id": session_id},
            )

        battle = action_resp.json()["session"]["battle_state"]
        assert battle is not None
        assert "player" in battle["turn_order"]
        assert len(battle["turn_order"]) == len(battle["combatants"])
        assert {c["id"] for c in battle["combatants"]} == set(battle["turn_order"])

    @pytest.mark.asyncio
    async def test_long_rest_via_gm_state_changes(self, client: AsyncClient):
        low_hp_char = {
            **CHARACTER_PAYLOAD,
            "hp_current": 5,
            "spell_slots": {"1": {"current": 0, "maximum": 4}},
        }
        payload = {**SESSION_PAYLOAD, "character": low_hp_char}
        create_resp = await client.post("/api/session/start", json=payload)
        session_id = create_resp.json()["session"]["id"]

        with _patch_action(_gm("You camp until dawn.", long_rest=True)):
            action_resp = await client.post(
                f"/api/session/{session_id}/action",
                json={"action": "I take a long rest.", "session_id": session_id},
            )

        character = action_resp.json()["session"]["character"]
        assert character["hp_current"] == 18
        assert character["spell_slots"]["1"]["current"] == 4

    @pytest.mark.asyncio
    async def test_submit_roll(self, client: AsyncClient):
        create_resp = await client.post("/api/session/start", json=SESSION_PAYLOAD)
        session_id = create_resp.json()["session"]["id"]

        with _patch_roll(_gm("The lock clicks open.")):
            roll_resp = await client.post(
                f"/api/session/{session_id}/roll",
                json={"roll": 17, "session_id": session_id},
            )

        assert roll_resp.status_code == 200
        data = roll_resp.json()
        assert data["gm_response"]["narrative"] == "The lock clicks open."
        assert data["session"]["turn_count"] == 1

    @pytest.mark.asyncio
    async def test_long_rest_restores_hp(self, client: AsyncClient):
        low_hp_char = {**CHARACTER_PAYLOAD, "hp_current": 5}
        payload = {**SESSION_PAYLOAD, "character": low_hp_char}
        create_resp = await client.post("/api/session/start", json=payload)
        session_id = create_resp.json()["session"]["id"]

        rest_resp = await client.post(
            f"/api/session/{session_id}/rest",
            json={"type": "long"},
        )
        assert rest_resp.status_code == 200
        data = rest_resp.json()
        assert data["session"]["character"]["hp_current"] == 18  # restored to max
        history = data["session"]["chat_history"]
        assert history[-2]["role"] == "player"
        assert "long rest" in history[-2]["content"].lower()
        assert history[-1]["role"] == "gm"
        assert "long rest" in history[-1]["content"].lower()

    @pytest.mark.asyncio
    async def test_save_and_load_slot(self, client: AsyncClient):
        create_resp = await client.post("/api/session/start", json=SESSION_PAYLOAD)
        session_id = create_resp.json()["session"]["id"]

        save_resp = await client.post(
            f"/api/session/{session_id}/save",
            json={"slot": 1},
        )
        assert save_resp.status_code == 200
        assert save_resp.json()["saved"] is True

        load_resp = await client.post(
            f"/api/session/{session_id}/load",
            json={"slot": 1},
        )
        assert load_resp.status_code == 200
        assert load_resp.json()["session"]["character"]["name"] == "Aria"

    @pytest.mark.asyncio
    async def test_load_empty_slot_returns_404(self, client: AsyncClient):
        create_resp = await client.post("/api/session/start", json=SESSION_PAYLOAD)
        session_id = create_resp.json()["session"]["id"]

        resp = await client.post(
            f"/api/session/{session_id}/load",
            json={"slot": 3},
        )
        assert resp.status_code == 404


class TestCharacterEndpoints:
    @pytest.mark.asyncio
    async def test_list_classes(self, client: AsyncClient):
        resp = await client.get("/api/character/classes")
        assert resp.status_code == 200
        classes = resp.json()
        assert "Fighter" in classes
        assert "Wizard" in classes

    @pytest.mark.asyncio
    async def test_list_races(self, client: AsyncClient):
        resp = await client.get("/api/character/races")
        assert resp.status_code == 200
        assert "Elf" in resp.json()

    @pytest.mark.asyncio
    async def test_ability_modifier(self, client: AsyncClient):
        resp = await client.get("/api/character/ability-modifier/16")
        assert resp.status_code == 200
        assert resp.json()["modifier"] == 3

    @pytest.mark.asyncio
    async def test_create_character_computes_prof_bonus(self, client: AsyncClient):
        resp = await client.post("/api/character/create", json=CHARACTER_PAYLOAD)
        assert resp.status_code == 200
        assert resp.json()["proficiency_bonus"] == 2  # level 3
