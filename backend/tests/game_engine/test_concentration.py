"""Tests for game_engine/concentration.py"""
import pytest

from app.game_engine.character import AbilityScores, EngineCharacter
from app.game_engine.concentration import (
    concentration_dc,
    check_concentration,
    start_concentration,
    end_concentration,
)
from app.game_engine.conditions import has_condition


def make_char(hp=30, conditions=()) -> EngineCharacter:
    return EngineCharacter(
        id="player",
        name="Hero",
        race="Human",
        char_class="Wizard",
        level=5,
        xp=6500,
        hp_current=hp,
        hp_max=30,
        abilities=AbilityScores(strength=10, dexterity=12, constitution=14),
        proficiency_bonus=3,
        skills=(),
        inventory=(),
        spell_slots={},
        death_saves={"successes": 0, "failures": 0},
        conditions=conditions,
    )


class TestConcentrationDC:
    def test_min_dc_is_10(self):
        assert concentration_dc(10) == 10
        assert concentration_dc(1) == 10

    def test_dc_is_half_damage(self):
        assert concentration_dc(40) == 20
        assert concentration_dc(21) == 10  # 10.5 floored to 10, but max(10, 10) = 10
        assert concentration_dc(22) == 11


class TestCheckConcentration:
    def test_no_concentrating_condition_does_nothing(self):
        char = make_char()
        updated = check_concentration(char, damage=30, con_save_roll=1)
        assert char is updated  # unchanged

    def test_passed_save_keeps_concentration(self):
        char = make_char(conditions=("concentrating",))
        updated = check_concentration(char, damage=20, con_save_roll=10)  # DC = 10
        assert has_condition(updated, "concentrating") is True

    def test_failed_save_loses_concentration(self):
        char = make_char(conditions=("concentrating",))
        updated = check_concentration(char, damage=30, con_save_roll=9)  # DC = 15
        assert has_condition(updated, "concentrating") is False

    def test_damage_zero_still_can_break_concentration(self):
        """DC = max(10, 0//2) = 10, so a bad roll can still break it."""
        char = make_char(conditions=("concentrating",))
        updated = check_concentration(char, damage=0, con_save_roll=1)
        assert has_condition(updated, "concentrating") is False  # DC=10, roll 1 < 10

    def test_immutable_original(self):
        char = make_char(conditions=("concentrating",))
        check_concentration(char, damage=30, con_save_roll=1)
        assert has_condition(char, "concentrating") is True


class TestStartConcentration:
    def test_start_adds_condition(self):
        char = make_char()
        updated = start_concentration(char)
        assert has_condition(updated, "concentrating") is True

    def test_replaces_existing_concentration(self):
        char = make_char(conditions=("concentrating",))
        updated = start_concentration(char)
        assert has_condition(updated, "concentrating") is True
        assert updated.conditions.count("concentrating") == 1


class TestEndConcentration:
    def test_end_removes_condition(self):
        char = make_char(conditions=("concentrating",))
        updated = end_concentration(char)
        assert has_condition(updated, "concentrating") is False

    def test_end_idempotent(self):
        char = make_char()
        updated = end_concentration(char)
        assert has_condition(updated, "concentrating") is False
