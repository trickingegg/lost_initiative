"""
Combat turn order and NPC follow-up. No live AI.
"""
from unittest.mock import AsyncMock, patch

import pytest

from app.models.domain import BattleState, Combatant, GameSession, GMResponse, StateChanges
from app.services.combat_flow import (
    MAX_NPC_TURNS_PER_REQUEST,
    advance_battle_turn,
    continue_combat,
    current_combatant,
    is_player_combatant,
)
from tests.test_session_service import make_session


def _combatant(cid: str, name: str, hp: int = 7, is_player: bool = False, init: int = 10) -> Combatant:
    return Combatant(
        id=cid,
        name=name,
        hp_current=hp,
        hp_max=max(hp, 1),
        ac=15,
        initiative=init,
        initiative_bonus=0,
        cr=0.25,
        is_player=is_player,
    )


def _battle(order, current=0, round_number=1, hp_by_id=None) -> BattleState:
    hp_by_id = hp_by_id or {}
    combatants = []
    for cid in order:
        is_player = cid == "player"
        combatants.append(_combatant(
            cid,
            "Aria" if is_player else cid.replace("_", " ").title(),
            hp=hp_by_id.get(cid, 18 if is_player else 7),
            is_player=is_player,
        ))
    return BattleState(
        combatants=combatants,
        turn_order=list(order),
        current_turn_index=current,
        round_number=round_number,
    )


class TestAdvanceTurn:
    def test_advances_to_next_combatant(self):
        battle = _battle(["goblin", "player"], current=0)
        nxt = advance_battle_turn(battle)
        assert current_combatant(nxt).id == "player"
        assert nxt.round_number == 1

    def test_wraps_and_increments_round(self):
        battle = _battle(["goblin", "player"], current=1, round_number=1)
        nxt = advance_battle_turn(battle)
        assert current_combatant(nxt).id == "goblin"
        assert nxt.round_number == 2

    def test_skips_dead_combatants(self):
        battle = _battle(["goblin", "orc", "player"], current=0, hp_by_id={"orc": 0})
        nxt = advance_battle_turn(battle)
        assert current_combatant(nxt).id == "player"


class TestContinueCombat:
    @pytest.mark.asyncio
    async def test_resolves_npc_when_it_is_their_turn(self):
        session = make_session(battle_state=_battle(["goblin", "player"], current=0))
        gm = GMResponse(narrative="You wait.", state_changes=StateChanges())
        npc_gm = GMResponse(narrative="The goblin stabs.", state_changes=StateChanges(damage=2))

        async def fake_process(sess, action):
            assert "Goblin" in action
            return npc_gm, sess

        with patch("app.ai_gm.gm_service.process_action", new=AsyncMock(side_effect=fake_process)):
            updated, last = await continue_combat(session, gm)

        assert "The goblin stabs." in updated.chat_history[-1].content
        assert updated.character.hp_current == 16
        assert current_combatant(updated.battle_state).id == "player"
        assert last.narrative == "The goblin stabs."

    @pytest.mark.asyncio
    async def test_does_not_advance_when_awaiting_roll(self):
        session = make_session(battle_state=_battle(["player", "goblin"], current=0))
        gm = GMResponse(
            narrative="Roll to hit.",
            state_changes=StateChanges(await_roll={
                "type": "ATTACK_ROLL",
                "ability": "strength",
                "dc": 15,
                "reason": "attack",
            }),
        )
        with patch("app.ai_gm.gm_service.process_action", new=AsyncMock()) as mocked:
            updated, last = await continue_combat(session, gm)
        mocked.assert_not_called()
        assert current_combatant(updated.battle_state).id == "player"
        assert last.state_changes.await_roll is not None

    @pytest.mark.asyncio
    async def test_advances_player_turn_then_stops_on_player(self):
        session = make_session(battle_state=_battle(["player", "goblin"], current=0))
        gm = GMResponse(narrative="You swing.", state_changes=StateChanges())
        npc_gm = GMResponse(narrative="The goblin misses.", state_changes=StateChanges())

        async def fake(sess, action):
            return npc_gm, sess

        with patch("app.ai_gm.gm_service.process_action", new=AsyncMock(side_effect=fake)):
            updated, last = await continue_combat(session, gm)

        assert current_combatant(updated.battle_state).id == "player"
        assert updated.battle_state.round_number == 2
        assert last.narrative == "The goblin misses."

    @pytest.mark.asyncio
    async def test_caps_npc_turns(self):
        order = [f"e{i}" for i in range(MAX_NPC_TURNS_PER_REQUEST + 2)] + ["player"]
        session = make_session(battle_state=_battle(order, current=0))
        gm = GMResponse(narrative="Combat rages.", state_changes=StateChanges())
        npc_gm = GMResponse(narrative="An enemy acts.", state_changes=StateChanges())

        async def fake(sess, action):
            return npc_gm, sess

        with patch("app.ai_gm.gm_service.process_action", new=AsyncMock(side_effect=fake)) as mocked:
            await continue_combat(session, gm)

        assert mocked.await_count == MAX_NPC_TURNS_PER_REQUEST

    def test_player_helper(self):
        assert is_player_combatant(_combatant("player", "Aria", is_player=True))
        assert not is_player_combatant(_combatant("goblin", "Goblin"))
