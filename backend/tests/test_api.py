"""
Integration tests for the API layer.
Uses SQLite in-memory via HTTPX async client + FastAPI test app.
"""
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.db.session import Base, engine


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

        action_resp = await client.post(
            f"/api/session/{session_id}/action",
            json={"action": "I look around the room.", "session_id": session_id},
        )
        assert action_resp.status_code == 200
        data = action_resp.json()
        assert "narrative" in data["gm_response"]
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

    @pytest.mark.asyncio
    async def test_save_slot_duplicate_overwrites(self, client: AsyncClient):
        """save_slot on same slot must overwrite, not fail."""
        create_resp = await client.post("/api/session/start", json=SESSION_PAYLOAD)
        session_id = create_resp.json()["session"]["id"]

        # first save
        r1 = await client.post(
            f"/api/session/{session_id}/save",
            json={"slot": 1},
        )
        assert r1.status_code == 200

        # second save to same slot — overwrite, must succeed
        r2 = await client.post(
            f"/api/session/{session_id}/save",
            json={"slot": 1},
        )
        assert r2.status_code == 200
        assert r2.json()["saved"] is True


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
