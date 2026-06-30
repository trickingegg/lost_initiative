"""
D&D 5e spell slot mechanics. Pure functions, no AI, no side effects.

Spell progression tables:
  FULL_CASTER_SLOTS   — Wizard, Cleric, Druid, Sorcerer, Bard (levels 1-20)
  HALF_CASTER_SLOTS   — Paladin, Ranger (starts at class level 2 effectively,
                         but we track class level directly; index 0 = class level 1)
  WARLOCK_SLOTS       — Pact magic, short-rest recovery, unique progression
"""
from __future__ import annotations

from typing import Dict, Optional

from app.game_engine.character import EngineCharacter, SpellSlot

# ---------------------------------------------------------------------------
# Slot tables: Dict[class_level, Dict[spell_level, slot_count]]
# ---------------------------------------------------------------------------

FULL_CASTER_SLOTS: Dict[int, Dict[int, int]] = {
    1:  {1: 2},
    2:  {1: 3},
    3:  {1: 4, 2: 2},
    4:  {1: 4, 2: 3},
    5:  {1: 4, 2: 3, 3: 2},
    6:  {1: 4, 2: 3, 3: 3},
    7:  {1: 4, 2: 3, 3: 3, 4: 1},
    8:  {1: 4, 2: 3, 3: 3, 4: 2},
    9:  {1: 4, 2: 3, 3: 3, 4: 3, 5: 1},
    10: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2},
    11: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1},
    12: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1},
    13: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1},
    14: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1},
    15: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1},
    16: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1},
    17: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1},
    18: {1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1},
    19: {1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1},
    20: {1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1},
}

# Half-casters (Paladin / Ranger) have no slots at level 1 of their class.
# From level 2 onward they follow roughly half the full-caster table.
HALF_CASTER_SLOTS: Dict[int, Dict[int, int]] = {
    1:  {},
    2:  {1: 2},
    3:  {1: 3},
    4:  {1: 3},
    5:  {1: 4, 2: 2},
    6:  {1: 4, 2: 2},
    7:  {1: 4, 2: 3},
    8:  {1: 4, 2: 3},
    9:  {1: 4, 2: 3, 3: 2},
    10: {1: 4, 2: 3, 3: 2},
    11: {1: 4, 2: 3, 3: 3},
    12: {1: 4, 2: 3, 3: 3},
    13: {1: 4, 2: 3, 3: 3, 4: 1},
    14: {1: 4, 2: 3, 3: 3, 4: 1},
    15: {1: 4, 2: 3, 3: 3, 4: 2},
    16: {1: 4, 2: 3, 3: 3, 4: 2},
    17: {1: 4, 2: 3, 3: 3, 4: 3, 5: 1},
    18: {1: 4, 2: 3, 3: 3, 4: 3, 5: 1},
    19: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2},
    20: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2},
}

# Warlock — pact magic: always 1 slot level (equal to highest available),
# slots restore on short rest. Number of slots per level:
WARLOCK_SLOT_COUNT: Dict[int, int] = {
    1: 1, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 2,
    11: 3, 12: 3, 13: 3, 14: 3, 15: 3, 16: 3, 17: 4, 18: 4, 19: 4, 20: 4,
}

WARLOCK_SLOT_LEVEL: Dict[int, int] = {
    1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5,
    11: 5, 12: 5, 13: 5, 14: 5, 15: 5, 16: 5, 17: 5, 18: 5, 19: 5, 20: 5,
}

FULL_CASTER_CLASSES = {"wizard", "cleric", "druid", "sorcerer", "bard", "necromancer"}
HALF_CASTER_CLASSES = {"paladin", "ranger"}
WARLOCK_CLASSES = {"warlock"}


def get_spell_slots_for_level(char_class: str, class_level: int) -> Dict[int, int]:
    """
    Return the raw slot table (spell_level -> count) for a caster at given class level.
    Non-casters return empty dict.
    """
    cls = char_class.lower()
    if cls in FULL_CASTER_CLASSES:
        return FULL_CASTER_SLOTS.get(class_level, {})
    if cls in HALF_CASTER_CLASSES:
        return HALF_CASTER_SLOTS.get(class_level, {})
    if cls in WARLOCK_CLASSES:
        count = WARLOCK_SLOT_COUNT.get(class_level, 0)
        level = WARLOCK_SLOT_LEVEL.get(class_level, 1)
        return {level: count} if count > 0 else {}
    return {}


def can_cast_spell(character: EngineCharacter, spell_level: int) -> bool:
    """
    Return True if character has at least one available slot of `spell_level` or higher.
    Cantrips (spell_level == 0) are always castable.
    """
    if spell_level == 0:
        return True
    for lvl, slot in character.spell_slots.items():
        if lvl >= spell_level and slot.current > 0:
            return True
    return False


def expend_spell_slot(character: EngineCharacter, spell_level: int) -> EngineCharacter:
    """
    Expend the lowest available slot >= spell_level.
    Raises ValueError if no valid slot is available.
    Returns new EngineCharacter with updated spell slots.
    """
    if spell_level == 0:
        return character  # cantrips don't use slots

    available_levels = sorted(
        lvl for lvl, slot in character.spell_slots.items()
        if lvl >= spell_level and slot.current > 0
    )
    if not available_levels:
        raise ValueError(
            f"No available spell slot of level {spell_level} or higher"
        )

    target_level = available_levels[0]
    old_slot = character.spell_slots[target_level]
    new_slot = SpellSlot(current=old_slot.current - 1, maximum=old_slot.maximum)
    updated_slots = dict(character.spell_slots)
    updated_slots[target_level] = new_slot
    return character.with_changes(spell_slots=updated_slots)


def restore_warlock_slots_on_short_rest(character: EngineCharacter) -> EngineCharacter:
    """
    Warlocks recover all pact magic slots on a short rest.
    Only operates when char_class is warlock.
    """
    if character.char_class.lower() not in WARLOCK_CLASSES:
        return character

    restored = {
        lvl: SpellSlot(current=slot.maximum, maximum=slot.maximum)
        for lvl, slot in character.spell_slots.items()
    }
    return character.with_changes(spell_slots=restored)


def build_initial_spell_slots(char_class: str, class_level: int) -> Dict[int, SpellSlot]:
    """
    Build the initial SpellSlot dict for a new character.
    """
    raw = get_spell_slots_for_level(char_class, class_level)
    return {lvl: SpellSlot(current=count, maximum=count) for lvl, count in raw.items()}
