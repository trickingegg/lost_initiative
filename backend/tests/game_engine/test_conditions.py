"""Tests for game_engine/conditions.py"""
import pytest

from app.game_engine.character import AbilityScores, EngineCharacter
from app.game_engine.conditions import (
    ALL_CONDITIONS,
    apply_condition,
    clear_condition,
    clear_all_conditions,
    get_condition_description,
    attacker_has_advantage_vs,
    creature_has_attack_disadvantage,
    is_incapacitated,
    has_condition,
)


def make_char(conditions=()) -> EngineCharacter:
    return EngineCharacter(
        id="test",
        name="Hero",
        race="Human",
        char_class="Fighter",
        level=1,
        xp=0,
        hp_current=10,
        hp_max=10,
        abilities=AbilityScores(),
        proficiency_bonus=2,
        skills=(),
        inventory=(),
        spell_slots={},
        conditions=tuple(conditions),
        death_saves={"successes": 0, "failures": 0},
    )


class TestAllConditions:
    def test_has_14_official_conditions(self):
        official = {
            "blinded", "charmed", "deafened", "exhaustion", "frightened",
            "grappled", "incapacitated", "invisible", "paralyzed", "petrified",
            "poisoned", "prone", "restrained", "stunned", "unconscious",
        }
        assert official.issubset(ALL_CONDITIONS)

    def test_total_conditions_count(self):
        assert len(ALL_CONDITIONS) >= 15  # 14 + at least dead/stable/concentrating


class TestApplyCondition:
    def test_adds_condition(self):
        char = make_char()
        updated = apply_condition(char, "poisoned")
        assert "poisoned" in updated.conditions

    def test_idempotent(self):
        char = make_char(conditions=("poisoned",))
        updated = apply_condition(char, "poisoned")
        assert updated.conditions.count("poisoned") == 1

    def test_normalizes_case(self):
        char = make_char()
        updated = apply_condition(char, "PRONE")
        assert "prone" in updated.conditions

    def test_raises_for_unknown_condition(self):
        char = make_char()
        with pytest.raises(ValueError):
            apply_condition(char, "confused")

    def test_original_unchanged(self):
        char = make_char()
        apply_condition(char, "stunned")
        assert "stunned" not in char.conditions

    def test_multiple_conditions(self):
        char = make_char()
        char = apply_condition(char, "poisoned")
        char = apply_condition(char, "prone")
        assert "poisoned" in char.conditions
        assert "prone" in char.conditions


class TestClearCondition:
    def test_removes_condition(self):
        char = make_char(conditions=("poisoned",))
        updated = clear_condition(char, "poisoned")
        assert "poisoned" not in updated.conditions

    def test_idempotent_when_absent(self):
        char = make_char()
        updated = clear_condition(char, "poisoned")
        assert "poisoned" not in updated.conditions

    def test_only_removes_target_condition(self):
        char = make_char(conditions=("poisoned", "prone"))
        updated = clear_condition(char, "poisoned")
        assert "prone" in updated.conditions
        assert "poisoned" not in updated.conditions


class TestClearAllConditions:
    def test_removes_all(self):
        char = make_char(conditions=("poisoned", "prone", "stunned"))
        updated = clear_all_conditions(char)
        assert updated.conditions == ()


class TestGetConditionDescription:
    def test_returns_non_empty_description(self):
        desc = get_condition_description("poisoned")
        assert len(desc) > 10

    def test_case_insensitive(self):
        desc = get_condition_description("BLINDED")
        assert len(desc) > 0

    def test_raises_for_unknown(self):
        with pytest.raises(ValueError):
            get_condition_description("cursed_custom")

    @pytest.mark.parametrize("condition", [
        "blinded", "charmed", "deafened", "exhaustion", "frightened",
        "grappled", "incapacitated", "invisible", "paralyzed", "petrified",
        "poisoned", "prone", "restrained", "stunned", "unconscious",
    ])
    def test_all_official_conditions_have_descriptions(self, condition):
        desc = get_condition_description(condition)
        assert isinstance(desc, str)
        assert len(desc) > 0


class TestCombatHelpers:
    def test_attacker_has_advantage_vs_stunned(self):
        char = make_char(conditions=("stunned",))
        assert attacker_has_advantage_vs(char) is True

    def test_attacker_no_advantage_vs_charmed(self):
        char = make_char(conditions=("charmed",))
        assert attacker_has_advantage_vs(char) is False

    def test_creature_has_attack_disadvantage_when_poisoned(self):
        char = make_char(conditions=("poisoned",))
        assert creature_has_attack_disadvantage(char) is True

    def test_creature_no_attack_disadvantage_when_clean(self):
        char = make_char()
        assert creature_has_attack_disadvantage(char) is False

    def test_is_incapacitated_when_paralyzed(self):
        char = make_char(conditions=("paralyzed",))
        assert is_incapacitated(char) is True

    def test_not_incapacitated_when_poisoned_only(self):
        char = make_char(conditions=("poisoned",))
        assert is_incapacitated(char) is False

    def test_has_condition_true(self):
        char = make_char(conditions=("prone",))
        assert has_condition(char, "prone") is True

    def test_has_condition_false(self):
        char = make_char()
        assert has_condition(char, "prone") is False
