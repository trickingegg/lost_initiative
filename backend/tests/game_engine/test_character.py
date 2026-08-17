"""Tests for game_engine/character.py"""
import pytest
from unittest.mock import patch

from app.game_engine.character import (
    AbilityScores,
    EngineCharacter,
    SpellSlot,
    LevelUpChoices,
    XP_THRESHOLDS,
    calculate_modifier,
    calculate_proficiency_bonus,
    calculate_ac,
    calculate_skill_bonus,
    apply_long_rest,
    apply_short_rest,
    level_up,
    get_level_for_xp,
)


def make_character(**kwargs) -> EngineCharacter:
    defaults = dict(
        id="test-1",
        name="Thorin",
        race="Dwarf",
        char_class="Fighter",
        level=5,
        xp=6500,
        hp_current=30,
        hp_max=45,
        abilities=AbilityScores(strength=16, dexterity=12, constitution=14),
        proficiency_bonus=3,
        skills=("Athletics", "Perception"),
        inventory=(),
        spell_slots={},
        death_saves={"successes": 0, "failures": 0},
    )
    defaults.update(kwargs)
    return EngineCharacter(**defaults)


class TestCalculateModifier:
    def test_score_10_gives_0(self):
        assert calculate_modifier(10) == 0

    def test_score_11_gives_0(self):
        assert calculate_modifier(11) == 0

    def test_score_12_gives_plus_1(self):
        assert calculate_modifier(12) == 1

    def test_score_8_gives_minus_1(self):
        assert calculate_modifier(8) == -1

    def test_score_20_gives_plus_5(self):
        assert calculate_modifier(20) == 5

    def test_score_1_gives_minus_5(self):
        assert calculate_modifier(1) == -5


class TestCalculateProficiencyBonus:
    @pytest.mark.parametrize("level,expected", [
        (1, 2), (2, 2), (3, 2), (4, 2),
        (5, 3), (6, 3), (7, 3), (8, 3),
        (9, 4), (10, 4), (11, 4), (12, 4),
        (13, 5), (14, 5), (15, 5), (16, 5),
        (17, 6), (18, 6), (19, 6), (20, 6),
    ])
    def test_all_levels(self, level, expected):
        assert calculate_proficiency_bonus(level) == expected

    def test_level_0_raises(self):
        with pytest.raises(ValueError):
            calculate_proficiency_bonus(0)

    def test_level_21_raises(self):
        with pytest.raises(ValueError):
            calculate_proficiency_bonus(21)


class TestCalculateAC:
    def test_unarmored_base(self):
        char = make_character(abilities=AbilityScores(dexterity=14))
        assert calculate_ac(char) == 12  # 10 + 2

    def test_leather_armor_plus_dex(self):
        char = make_character(
            abilities=AbilityScores(dexterity=16),
            inventory=({"name": "Leather Armor"},),
        )
        assert calculate_ac(char) == 14  # 11 + 3

    def test_chain_mail_no_dex(self):
        char = make_character(
            abilities=AbilityScores(dexterity=18),
            inventory=({"name": "Chain Mail"},),
        )
        assert calculate_ac(char) == 16  # heavy, no DEX

    def test_scale_mail_dex_capped_at_2(self):
        char = make_character(
            abilities=AbilityScores(dexterity=18),
            inventory=({"name": "Scale Mail"},),
        )
        assert calculate_ac(char) == 16  # 14 + min(4,2) = 16

    def test_shield_bonus_applied(self):
        char = make_character(
            abilities=AbilityScores(dexterity=10),
            inventory=({"name": "Shield"},),
        )
        assert calculate_ac(char) == 12  # 10 + 0 + 2

    def test_armor_plus_shield(self):
        char = make_character(
            abilities=AbilityScores(dexterity=14),
            inventory=({"name": "Leather Armor"}, {"name": "Shield"}),
        )
        assert calculate_ac(char) == 15  # 11 + 2(dex) + 2(shield)

    def test_monk_unarmored_defense(self):
        char = make_character(
            char_class="Monk",
            abilities=AbilityScores(dexterity=14, wisdom=16),
        )
        assert calculate_ac(char) == 15  # 10 + 2(dex) + 3(wis)


class TestCalculateSkillBonus:
    def test_proficient_skill(self):
        char = make_character(
            abilities=AbilityScores(strength=16),
            proficiency_bonus=3,
            skills=("Athletics",),
        )
        assert calculate_skill_bonus(char, "Athletics") == 6  # 3 + 3

    def test_non_proficient_skill(self):
        char = make_character(
            abilities=AbilityScores(dexterity=14),
            proficiency_bonus=3,
            skills=(),
        )
        assert calculate_skill_bonus(char, "Stealth") == 2  # 2 (dex), no proficiency

    def test_unknown_skill_raises(self):
        char = make_character()
        with pytest.raises(ValueError):
            calculate_skill_bonus(char, "Cooking")


class TestApplyLongRest:
    def test_hp_restored_to_max(self):
        char = make_character(hp_current=5, hp_max=45)
        result = apply_long_rest(char)
        assert result.hp_current == 45

    def test_spell_slots_restored(self):
        char = make_character(spell_slots={1: SpellSlot(current=0, maximum=4)})
        result = apply_long_rest(char)
        assert result.spell_slots[1].current == 4

    def test_ki_restored(self):
        char = make_character(ki_current=0, ki_max=5)
        result = apply_long_rest(char)
        assert result.ki_current == 5

    def test_death_saves_reset(self):
        char = make_character(death_saves={"successes": 2, "failures": 1})
        result = apply_long_rest(char)
        assert result.death_saves == {"successes": 0, "failures": 0}

    def test_recovers_half_hit_dice(self):
        char = make_character(level=4, hit_dice_current=0, hit_dice_max=4)
        result = apply_long_rest(char)
        assert result.hit_dice_current == 2

    def test_clears_unconscious_when_hp_restored(self):
        char = make_character(hp_current=0, conditions=("unconscious", "stable"))
        result = apply_long_rest(char)
        assert result.hp_current == 45
        assert "unconscious" not in result.conditions
        assert "stable" not in result.conditions

    def test_original_unchanged(self):
        char = make_character(hp_current=10)
        apply_long_rest(char)
        assert char.hp_current == 10


class TestApplyShortRest:
    def test_hp_increases(self):
        char = make_character(hp_current=10, hp_max=45, char_class="Fighter",
                              abilities=AbilityScores(constitution=14))
        result = apply_short_rest(char, hit_dice_spent=2)
        assert result.hp_current >= 10

    def test_hp_capped_at_max(self):
        char = make_character(hp_current=44, hp_max=45, char_class="Fighter",
                              abilities=AbilityScores(constitution=10))
        result = apply_short_rest(char, hit_dice_spent=3)
        assert result.hp_current <= 45

    def test_zero_hit_dice(self):
        char = make_character(hp_current=20, hp_max=45)
        result = apply_short_rest(char, hit_dice_spent=0)
        assert result.hp_current == 20

    def test_spending_more_than_remaining_raises(self):
        char = make_character(level=2, hit_dice_current=1, hit_dice_max=2)
        with pytest.raises(ValueError, match="Not enough hit dice"):
            apply_short_rest(char, hit_dice_spent=2)

    def test_decrements_hit_dice(self):
        char = make_character(level=5, hit_dice_current=5, hit_dice_max=5, hp_current=10)
        result = apply_short_rest(char, hit_dice_spent=2)
        assert result.hit_dice_current == 3

    def test_negative_dice_raises(self):
        char = make_character()
        with pytest.raises(ValueError):
            apply_short_rest(char, hit_dice_spent=-1)


class TestLevelUp:
    def test_level_increases_by_one(self):
        char = make_character(level=4, char_class="Fighter",
                              abilities=AbilityScores(constitution=14))
        result, choices = level_up(char)
        assert result.level == 5
        assert choices.new_level == 5

    def test_hp_max_increases(self):
        char = make_character(level=4, hp_max=32, hp_current=32, char_class="Fighter",
                              abilities=AbilityScores(constitution=10))
        result, choices = level_up(char)
        assert result.hp_max > 32
        assert choices.hp_increase > 0

    def test_prof_bonus_updates(self):
        char = make_character(level=4, proficiency_bonus=2, char_class="Fighter",
                              abilities=AbilityScores())
        result, _ = level_up(char)
        assert result.proficiency_bonus == 3

    def test_max_level_raises(self):
        char = make_character(level=20)
        with pytest.raises(ValueError):
            level_up(char)

    def test_original_unchanged(self):
        char = make_character(level=3, char_class="Rogue",
                              abilities=AbilityScores(constitution=10))
        level_up(char)
        assert char.level == 3


class TestGetLevelForXP:
    @pytest.mark.parametrize("xp,expected_level", [
        (0, 1),
        (299, 1),
        (300, 2),
        (899, 2),
        (900, 3),
        (6500, 5),
        (355000, 20),
        (999999, 20),
    ])
    def test_xp_to_level_mapping(self, xp, expected_level):
        assert get_level_for_xp(xp) == expected_level
