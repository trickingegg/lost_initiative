"""Tests for game_engine/exhaustion.py"""
import pytest

from app.game_engine.character import AbilityScores, EngineCharacter
from app.game_engine.conditions import has_condition
from app.game_engine.exhaustion import (
    apply_exhaustion,
    clear_exhaustion,
    reduce_exhaustion,
    get_exhaustion_level,
    get_effective_speed,
    get_effective_hp_max,
    has_exhaustion_penalty,
)


def make_char(hp=30, exhaustion=0) -> EngineCharacter:
    return EngineCharacter(
        id="player",
        name="Hero",
        race="Human",
        char_class="Fighter",
        level=5,
        xp=6500,
        hp_current=hp,
        hp_max=30,
        abilities=AbilityScores(strength=16, dexterity=12, constitution=14),
        proficiency_bonus=3,
        skills=(),
        inventory=(),
        spell_slots={},
        death_saves={"successes": 0, "failures": 0},
        exhaustion=exhaustion,
    )


class TestApplyExhaustion:
    def test_increases_from_zero(self):
        char = make_char()
        updated = apply_exhaustion(char)
        assert get_exhaustion_level(updated) == 1

    def test_increases_multiple_levels(self):
        char = make_char()
        updated = apply_exhaustion(char, level_increase=3)
        assert get_exhaustion_level(updated) == 3

    def test_capped_at_six(self):
        char = make_char(exhaustion=5)
        updated = apply_exhaustion(char, level_increase=3)
        assert get_exhaustion_level(updated) == 6

    def test_level_6_adds_dead_condition(self):
        char = make_char()
        updated = apply_exhaustion(char, level_increase=6)
        assert has_condition(updated, "dead") is True

    def test_level_6_from_existing_adds_dead(self):
        char = make_char(exhaustion=3)
        updated = apply_exhaustion(char, level_increase=3)
        assert has_condition(updated, "dead") is True

    def test_immutable(self):
        char = make_char()
        apply_exhaustion(char)
        assert get_exhaustion_level(char) == 0


class TestClearExhaustion:
    def test_clears_all_levels(self):
        char = make_char(exhaustion=4)
        updated = clear_exhaustion(char)
        assert get_exhaustion_level(updated) == 0


class TestReduceExhaustion:
    def test_reduces_by_one(self):
        char = make_char(exhaustion=3)
        updated = reduce_exhaustion(char, levels=1)
        assert get_exhaustion_level(updated) == 2

    def test_clamped_at_zero(self):
        char = make_char(exhaustion=0)
        updated = reduce_exhaustion(char, levels=5)
        assert get_exhaustion_level(updated) == 0


class TestGetEffectiveSpeed:
    def test_no_penalty_at_level_0(self):
        char = make_char()
        assert get_effective_speed(char, base_speed=30) == 30

    def test_halved_at_level_2(self):
        char = make_char(exhaustion=2)
        assert get_effective_speed(char, base_speed=30) == 15

    def test_zero_at_level_5(self):
        char = make_char(exhaustion=5)
        assert get_effective_speed(char, base_speed=30) == 0


class TestGetEffectiveHpMax:
    def test_no_penalty_at_level_0(self):
        char = make_char()
        assert get_effective_hp_max(char) == 30

    def test_halved_at_level_4(self):
        char = make_char(exhaustion=4)
        assert get_effective_hp_max(char) == 15

    def test_still_halved_at_level_5(self):
        char = make_char(exhaustion=5, hp=30)
        assert get_effective_hp_max(char) == 15


class TestHasExhaustionPenalty:
    def test_ability_checks_from_level_1(self):
        char = make_char(exhaustion=1)
        assert has_exhaustion_penalty(char, "ability_checks") is True

    def test_speed_from_level_2(self):
        assert has_exhaustion_penalty(make_char(exhaustion=2), "speed") is True
        assert has_exhaustion_penalty(make_char(exhaustion=1), "speed") is False

    def test_attacks_saves_from_level_3(self):
        assert has_exhaustion_penalty(make_char(exhaustion=3), "attacks_saves") is True
        assert has_exhaustion_penalty(make_char(exhaustion=2), "attacks_saves") is False

    def test_hp_max_from_level_4(self):
        assert has_exhaustion_penalty(make_char(exhaustion=4), "hp_max") is True
        assert has_exhaustion_penalty(make_char(exhaustion=3), "hp_max") is False

    def test_death_from_level_6(self):
        assert has_exhaustion_penalty(make_char(exhaustion=6), "death") is True

    def test_no_penalty_at_zero(self):
        char = make_char(exhaustion=0)
        assert has_exhaustion_penalty(char, "ability_checks") is False
