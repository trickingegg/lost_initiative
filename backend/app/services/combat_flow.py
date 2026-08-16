"""
Combat turn advancement and NPC follow-up after a player action/roll.

The engine advances whose turn it is. The GM only narrates an NPC turn.
Capped so one player request cannot fan out into an unbounded provider loop.
"""
from __future__ import annotations

from typing import Optional, Tuple

from app.models.domain import BattleState, ChatMessage, Combatant, GameSession, GMResponse
from app.services.session_service import apply_state_changes

MAX_NPC_TURNS_PER_REQUEST = 4

_NPC_TURN_PROMPT = (
    "It is {name}'s turn in combat. Resolve this creature's action now. "
    "Use combatant_damage for hits on enemies. Use damage for hits on the player. "
    "Do not ask the player for a roll unless this action forces a saving throw. "
    "Narrate only this creature's turn."
)


def current_combatant(battle: BattleState) -> Optional[Combatant]:
    if not battle.turn_order:
        return None
    index = battle.current_turn_index % len(battle.turn_order)
    combatant_id = battle.turn_order[index]
    for combatant in battle.combatants:
        if combatant.id == combatant_id:
            return combatant
    return None


def is_player_combatant(combatant: Combatant) -> bool:
    return combatant.is_player or combatant.id == "player"


def advance_battle_turn(battle: BattleState) -> BattleState:
    order = list(battle.turn_order)
    if not order:
        return battle
    alive = {combatant.id for combatant in battle.combatants if combatant.hp_current > 0}
    if not alive:
        return battle

    index = battle.current_turn_index
    round_number = battle.round_number
    for _ in range(len(order)):
        index = (index + 1) % len(order)
        if index == 0:
            round_number += 1
        if order[index] in alive:
            return battle.model_copy(update={
                "current_turn_index": index,
                "round_number": round_number,
            })
    return battle


def _append_chat(session: GameSession, *messages: ChatMessage) -> GameSession:
    return session.model_copy(update={
        "chat_history": list(session.chat_history) + list(messages),
    })


async def continue_combat(
    session: GameSession,
    gm_response: GMResponse,
) -> Tuple[GameSession, GMResponse]:
    """
    After a player action/roll is applied:
    - if the player just acted, advance the turn
    - resolve NPC turns until the player's turn, a roll is required, or the cap
    """
    if gm_response.state_changes.await_roll:
        return session, gm_response
    if session.battle_state is None:
        return session, gm_response

    started_now = bool(gm_response.state_changes.start_battle)
    if not started_now:
        current = current_combatant(session.battle_state)
        if current is not None and is_player_combatant(current):
            session = session.model_copy(
                update={"battle_state": advance_battle_turn(session.battle_state)}
            )

    last_gm = gm_response
    from app.ai_gm.gm_service import process_action

    for _ in range(MAX_NPC_TURNS_PER_REQUEST):
        battle = session.battle_state
        if battle is None or last_gm.state_changes.await_roll:
            break
        if last_gm.state_changes.end_battle:
            break

        current = current_combatant(battle)
        if current is None:
            break
        if current.hp_current <= 0:
            session = session.model_copy(update={"battle_state": advance_battle_turn(battle)})
            continue
        if is_player_combatant(current):
            break

        npc_gm, session_with_memory = await process_action(
            session, _NPC_TURN_PROMPT.format(name=current.name)
        )
        session = apply_state_changes(session_with_memory, npc_gm.state_changes)
        session = _append_chat(
            session,
            ChatMessage(role="system", content=f"[Turn: {current.name}]"),
            ChatMessage(role="gm", content=npc_gm.narrative),
        )
        last_gm = npc_gm
        if session.battle_state is None or npc_gm.state_changes.await_roll:
            break
        session = session.model_copy(
            update={"battle_state": advance_battle_turn(session.battle_state)}
        )

    return session, last_gm
