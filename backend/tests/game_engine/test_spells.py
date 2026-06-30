"""Tests for game_engine/spells.py"""
import pytest

from app.game_engine.character import AbilityScores, EngineCharacter, SpellSlot
from app.game_engine.spells import (
    FULL_CASTER_SLOTS,
    HALF_CASTER_SLOTS,
    WARLOCK_SLOT_COUNT,
    WARLOCK_SLOT_LEVEL,
    get_spell_slots_for_level,
    can_cast_spell,
    expend_spell_slot,
    restore_warlock_slots_on_short_rest,
    build_initial_spell_slots,
)


def make_char(char_class="Wizard", level=5, spell_slots=None) -> EngineCharacter:
    if spell_slots is None:
        spell_slots = build_initial_spell_slots(char_class, level)
    return EngineCharacter(
        id="test",
        name="Merlin",
        race="Human",
        char_class=char_class,
        level=level,
        xp=0,
        hp_current=20,
        hp_max=20,
        abilities=AbilityScores(intelligence=18),
        proficiency_bonus=3,
        skills=(),
        inventory=(),
        spell_slots=spell_slots,
        death_saves={"successes": 0, "failures": 0},
    )


class TestSlotTables:
    def test_full_caster_level1_has_two_l1_slots(self):
        assert FULL_CASTER_SLOTS[1] == {1: 2}

    def test_full_caster_level20_has_9th_level_slots(self):
        assert 9 in FULL_CASTER_SLOTS[20]
        assert FULL_CASTER_SLOTS[20][9] == 1

    def test_half_caster_level1_has_no_slots(self):
        assert HALF_CASTER_SLOTS[1] == {}

    def test_half_caster_level2_has_l1_slots(self):
        assert HALF_CASTER_SLOTS[2] == {1: 2}

    def test_warlock_slot_counts_increase_at_11(self):
        assert WARLOCK_SLOT_COUNT[10] == 2
        assert WARLOCK_SLOT_COUNT[11] == 3

    def test_warlock_slot_level_5_from_level9(self):
        assert WARLOCK_SLOT_LEVEL[9] == 5


class TestGetSpellSlotsForLevel:
    def test_wizard_level5(self):
        slots = get_spell_slots_for_level("Wizard", 5)
        assert slots[1] == 4
        assert slots[2] == 3
        assert slots[3] == 2

    def test_necromancer_treated_as_full_caster(self):
        slots = get_spell_slots_for_level("Necromancer", 3)
        assert slots.get(1) == 4
        assert slots.get(2) == 2

    def test_paladin_level1_no_slots(self):
        assert get_spell_slots_for_level("Paladin", 1) == {}

    def test_paladin_level5(self):
        slots = get_spell_slots_for_level("Paladin", 5)
        assert 1 in slots
        assert 2 in slots

    def test_warlock_level5_returns_3rd_level_slots(self):
        slots = get_spell_slots_for_level("Warlock", 5)
        assert 3 in slots
        assert slots[3] == 2

    def test_fighter_non_caster_returns_empty(self):
        assert get_spell_slots_for_level("Fighter", 10) == {}


class TestCanCastSpell:
    def test_cantrip_always_castable(self):
        char = make_char(spell_slots={})
        assert can_cast_spell(char, 0) is True

    def test_can_cast_when_slot_available(self):
        char = make_char(spell_slots={1: SpellSlot(current=2, maximum=2)})
        assert can_cast_spell(char, 1) is True

    def test_cannot_cast_when_no_slots(self):
        char = make_char(spell_slots={1: SpellSlot(current=0, maximum=2)})
        assert can_cast_spell(char, 1) is False

    def test_upcast_uses_higher_slot(self):
        char = make_char(spell_slots={2: SpellSlot(current=1, maximum=2)})
        assert can_cast_spell(char, 1) is True  # level 2 slot can be used for level 1

    def test_no_slots_at_all(self):
        char = make_char(spell_slots={})
        assert can_cast_spell(char, 1) is False


class TestExpendSpellSlot:
    def test_decrements_correct_slot(self):
        char = make_char(spell_slots={
            1: SpellSlot(current=4, maximum=4),
            2: SpellSlot(current=3, maximum=3),
        })
        updated = expend_spell_slot(char, 1)
        assert updated.spell_slots[1].current == 3
        assert updated.spell_slots[2].current == 3

    def test_uses_lowest_available_higher_slot(self):
        char = make_char(spell_slots={
            1: SpellSlot(current=0, maximum=4),
            2: SpellSlot(current=2, maximum=2),
        })
        updated = expend_spell_slot(char, 1)
        assert updated.spell_slots[2].current == 1

    def test_raises_when_no_slot_available(self):
        char = make_char(spell_slots={1: SpellSlot(current=0, maximum=4)})
        with pytest.raises(ValueError):
            expend_spell_slot(char, 1)

    def test_cantrip_does_not_change_slots(self):
        char = make_char(spell_slots={1: SpellSlot(current=3, maximum=4)})
        updated = expend_spell_slot(char, 0)
        assert updated.spell_slots[1].current == 3

    def test_original_unchanged(self):
        char = make_char(spell_slots={1: SpellSlot(current=4, maximum=4)})
        expend_spell_slot(char, 1)
        assert char.spell_slots[1].current == 4


class TestRestoreWarlockSlots:
    def test_warlock_slots_restored_on_short_rest(self):
        char = make_char(
            char_class="Warlock",
            spell_slots={3: SpellSlot(current=0, maximum=2)},
        )
        updated = restore_warlock_slots_on_short_rest(char)
        assert updated.spell_slots[3].current == 2

    def test_non_warlock_unaffected(self):
        char = make_char(
            char_class="Wizard",
            spell_slots={1: SpellSlot(current=0, maximum=4)},
        )
        updated = restore_warlock_slots_on_short_rest(char)
        assert updated.spell_slots[1].current == 0


class TestBuildInitialSpellSlots:
    def test_wizard_level3_returns_correct_slots(self):
        slots = build_initial_spell_slots("Wizard", 3)
        assert slots[1].current == 4
        assert slots[1].maximum == 4
        assert slots[2].current == 2

    def test_fighter_returns_empty(self):
        slots = build_initial_spell_slots("Fighter", 10)
        assert slots == {}

    def test_current_equals_maximum_on_init(self):
        slots = build_initial_spell_slots("Cleric", 9)
        for spell_lvl, slot in slots.items():
            assert slot.current == slot.maximum
