"""
Assembles the context window sent to Gemini each turn.

Algorithm (matches ARCHITECTURE.md):
  1. system prompt + character sheet + battle state  (always)
  2. relevant memory events (from session.memory_events)
  3. last N chat messages (MAX_HISTORY_MESSAGES)
  4. internal_gm_notes from previous turn
"""
from __future__ import annotations

from typing import List

from app.ai_gm.memory import format_memory_for_prompt, get_recent_memory_events
from app.ai_gm.prompts import build_system_prompt
from app.config import settings
from app.models.domain import BattleState, Character, ChatMessage, GameSession


# ---------------------------------------------------------------------------
# Character sheet formatter
# ---------------------------------------------------------------------------

def _format_character_sheet(c: Character) -> str:
    slots_str = ", ".join(
        f"L{lvl}:{slot.current}/{slot.maximum}"
        for lvl, slot in sorted(c.spell_slots.items())
    ) or "none"

    conditions_str = ", ".join(c.conditions) if c.conditions else "none"
    quests_str = (
        "\n".join(
            f"  [{q.status.upper()}] {q.title}: {q.description}"
            for q in c.quests
        ) or "  none"
    )

    ki_str = ""
    if c.ki_current is not None:
        ki_str = f"\nKi: {c.ki_current}/{c.ki_max}"

    inventory_str = (
        ", ".join(f"{i.name}×{i.quantity}" for i in c.inventory) or "empty"
    )

    return f"""{c.name} — Level {c.level} {c.race} {c.char_class}
HP: {c.hp_current}/{c.hp_max}  |  AC: {c.ac}  |  Speed: {c.speed}ft
XP: {c.xp}  |  Proficiency Bonus: +{c.proficiency_bonus}
Abilities — STR:{c.abilities.strength} DEX:{c.abilities.dexterity} CON:{c.abilities.constitution} INT:{c.abilities.intelligence} WIS:{c.abilities.wisdom} CHA:{c.abilities.charisma}
Skills (proficient): {', '.join(c.skills) or 'none'}
Spell Slots: {slots_str}{ki_str}
Conditions: {conditions_str}
Inventory: {inventory_str}
Death Saves: {c.death_saves.successes} successes / {c.death_saves.failures} failures
Quests:
{quests_str}"""


# ---------------------------------------------------------------------------
# Battle state formatter
# ---------------------------------------------------------------------------

def _format_battle_state(battle: BattleState) -> str:
    lines = [f"Round {battle.round_number} — Initiative Order:"]
    for i, cid in enumerate(battle.turn_order):
        marker = " ← CURRENT TURN" if i == battle.current_turn_index else ""
        combatant = next((c for c in battle.combatants if c.id == cid), None)
        if combatant:
            lines.append(
                f"  {combatant.name} (HP:{combatant.hp_current}/{combatant.hp_max} "
                f"AC:{combatant.ac}){marker}"
            )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Chat history formatter
# ---------------------------------------------------------------------------

def _format_history(messages: List[ChatMessage], max_messages: int) -> str:
    recent = messages[-max_messages:] if len(messages) > max_messages else messages
    lines = []
    for msg in recent:
        prefix = {"player": "PLAYER", "gm": "GM", "system": "SYSTEM"}.get(msg.role, msg.role.upper())
        lines.append(f"{prefix}: {msg.content}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main context builder
# ---------------------------------------------------------------------------

def build_context_window(session: GameSession) -> str:
    """
    Build the full prompt string to send to Gemini.
    Returns the system prompt with all context embedded.
    """
    character_sheet = _format_character_sheet(session.character)
    battle_state = (
        _format_battle_state(session.battle_state)
        if session.battle_state
        else ""
    )

    memory_events = get_recent_memory_events(session, settings.max_memory_events)
    memory_str = format_memory_for_prompt(memory_events)

    system = build_system_prompt(
        story_template=session.story_template,
        setting=session.setting,
        character_sheet=character_sheet,
        memory_events=memory_str,
        gm_notes=session.gm_internal_notes,
        battle_state=battle_state,
    )

    history_str = _format_history(session.chat_history, settings.max_history_messages)

    if history_str:
        return f"{system}\n\n--- CONVERSATION HISTORY ---\n{history_str}"
    return system
