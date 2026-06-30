"""
Tests for ai_gm/gm_service.py — mocking _call_gemini to avoid real Gemini calls.
"""
import json
import pytest
from unittest.mock import patch

from app.ai_gm import gm_service
from app.models.domain import (
    AbilityScores,
    Character,
    DeathSaves,
    GameSession,
    StateChanges,
)

VALID_GM_RESPONSE = {
    "narrative": "You step into a dimly lit chamber. The air smells of decay.",
    "state_changes": {},
    "internal_gm_notes": "Player entered the crypt.",
    "suggested_actions": ["Look around", "Proceed deeper", "Listen carefully"],
}

VALID_GM_RESPONSE_WITH_DAMAGE = {
    "narrative": "A skeleton slashes you!",
    "state_changes": {"damage": 7},
    "internal_gm_notes": "",
    "suggested_actions": ["Attack", "Flee"],
}


def make_session() -> GameSession:
    char = Character(
        id="char-1",
        name="Lyra",
        race="Elf",
        char_class="Rogue",
        background="Criminal",
        level=3,
        xp=900,
        hp_current=20,
        hp_max=20,
        ac=14,
        abilities=AbilityScores(),
        death_saves=DeathSaves(),
    )
    return GameSession(
        character=char,
        setting="The Haunted Crypt",
        story_template="dungeon_delve",
    )


class TestProcessAction:
    @pytest.mark.asyncio
    async def test_successful_response(self):
        session = make_session()
        with patch.object(gm_service, "_call_gemini", return_value=json.dumps(VALID_GM_RESPONSE)):
            response, updated = await gm_service.process_action(session, "I look around.")

        assert "dimly lit chamber" in response.narrative
        assert response.internal_gm_notes == "Player entered the crypt."
        assert "Look around" in response.suggested_actions

    @pytest.mark.asyncio
    async def test_response_with_state_changes(self):
        session = make_session()
        with patch.object(gm_service, "_call_gemini",
                          return_value=json.dumps(VALID_GM_RESPONSE_WITH_DAMAGE)):
            response, _ = await gm_service.process_action(session, "I advance.")

        assert response.state_changes.damage == 7

    @pytest.mark.asyncio
    async def test_retries_on_invalid_json(self):
        session = make_session()
        call_count = 0

        def mock_call(prompt: str) -> str:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return "this is not json at all"
            return json.dumps(VALID_GM_RESPONSE)

        with patch.object(gm_service, "_call_gemini", side_effect=mock_call):
            response, _ = await gm_service.process_action(session, "I do something.")

        assert call_count == 2
        assert "dimly lit chamber" in response.narrative

    @pytest.mark.asyncio
    async def test_fallback_after_all_retries_fail(self):
        session = make_session()
        with patch.object(gm_service, "_call_gemini", return_value="NOT JSON AT ALL"):
            response, _ = await gm_service.process_action(session, "I try something.")

        assert response.suggested_actions  # fallback provides suggestions
        assert len(response.narrative) > 0

    @pytest.mark.asyncio
    async def test_network_error_returns_fallback(self):
        session = make_session()
        with patch.object(gm_service, "_call_gemini",
                          side_effect=Exception("Connection reset")):
            response, _ = await gm_service.process_action(session, "I attack.")

        assert len(response.suggested_actions) > 0

    @pytest.mark.asyncio
    async def test_significant_event_adds_to_memory(self):
        session = make_session()
        response_with_battle = {
            **VALID_GM_RESPONSE,
            "state_changes": {
                "start_battle": [{"name": "Skeleton", "hp": 13, "ac": 13,
                                  "initiative_bonus": 0, "cr": 0.25}]
            },
        }
        with patch.object(gm_service, "_call_gemini",
                          return_value=json.dumps(response_with_battle)):
            _, updated_session = await gm_service.process_action(session, "I enter the room.")

        assert len(updated_session.memory_events) == 1
        assert "Skeleton" in updated_session.memory_events[0].event

    @pytest.mark.asyncio
    async def test_gm_notes_stored_in_session(self):
        session = make_session()
        with patch.object(gm_service, "_call_gemini",
                          return_value=json.dumps(VALID_GM_RESPONSE)):
            _, updated_session = await gm_service.process_action(session, "I explore.")

        assert updated_session.gm_internal_notes == "Player entered the crypt."

    @pytest.mark.asyncio
    async def test_strips_markdown_fences(self):
        session = make_session()
        wrapped = f"```json\n{json.dumps(VALID_GM_RESPONSE)}\n```"
        with patch.object(gm_service, "_call_gemini", return_value=wrapped):
            response, _ = await gm_service.process_action(session, "I look.")

        assert "dimly lit chamber" in response.narrative

    @pytest.mark.asyncio
    async def test_insignificant_turn_no_memory_event(self):
        session = make_session()
        boring_response = {
            "narrative": "You look around the empty room.",
            "state_changes": {},
            "internal_gm_notes": "",
            "suggested_actions": [],
        }
        with patch.object(gm_service, "_call_gemini",
                          return_value=json.dumps(boring_response)):
            _, updated_session = await gm_service.process_action(session, "Look around.")

        assert len(updated_session.memory_events) == 0


class TestProcessRollResult:
    @pytest.mark.asyncio
    async def test_roll_result_processed(self):
        session = make_session()
        with patch.object(gm_service, "_call_gemini",
                          return_value=json.dumps(VALID_GM_RESPONSE)):
            response, _ = await gm_service.process_roll_result(session, roll=17)

        assert response.narrative

    @pytest.mark.asyncio
    async def test_roll_fallback_on_error(self):
        session = make_session()
        with patch.object(gm_service, "_call_gemini", return_value="GARBAGE"):
            response, _ = await gm_service.process_roll_result(session, roll=5)

        assert response.narrative

    @pytest.mark.asyncio
    async def test_roll_retries_on_bad_json(self):
        session = make_session()
        call_count = 0

        def mock_call(prompt: str) -> str:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return "bad json"
            return json.dumps(VALID_GM_RESPONSE)

        with patch.object(gm_service, "_call_gemini", side_effect=mock_call):
            response, _ = await gm_service.process_roll_result(session, roll=12)

        assert call_count == 2
        assert "dimly lit chamber" in response.narrative
