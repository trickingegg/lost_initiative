"""Tests for game_engine/combat.py"""
import pytest
from unittest.mock import patch

from app.game_engine.character import AbilityScores, EngineCharacter, SpellSlot
from app.game_engine.combat import (
    Combatant,
    AttackResult,
    roll_initiative,
    resolve_attack,
    apply_damage,
    check_death_saves,
    calculate_xp_reward,
)


def make_char(char_id="player", hp=30, hp_max=30, ac=15) -> EngineCharacter:
    return EngineCharacter(
        id=char_id,
        name="Hero",
        race="Human",
        char_class="Fighter",
        level=5,
        xp=6500,
        hp_current=hp,
        hp_max=hp_max,
        abilities=AbilityScores(strength=16, dexterity=12, constitution=14),
        proficiency_bonus=3,
        skills=(),
        inventory=(),
        spell_slots={},
        death_saves={"successes": 0, "failures": 0},
    )


class TestRollInitiative:
    def test_returns_sorted_descending(self):
        combatants = [
            {"id": "player", "name": "Hero", "hp_current": 30, "hp_max": 30, "ac": 15, "initiative_bonus": 2, "is_player": True},
            {"id": "goblin1", "name": "Goblin", "hp_current": 7, "hp_max": 7, "ac": 15, "initiative_bonus": 2},
            {"id": "goblin2", "name": "Goblin 2", "hp_current": 7, "hp_max": 7, "ac": 15, "initiative_bonus": 0},
        ]
        result = roll_initiative(combatants)
        assert len(result) == 3
        for i in range(len(result) - 1):
            assert result[i].initiative >= result[i + 1].initiative

    def test_combatant_fields_populated(self):
        combatants = [
            {"id": "p1", "name": "Elf", "hp_current": 10, "hp_max": 10, "ac": 12, "initiative_bonus": 3},
        ]
        result = roll_initiative(combatants)
        c = result[0]
        assert c.id == "p1"
        assert c.name == "Elf"
        assert c.hp_max == 10
        assert c.ac == 12

    def test_initiative_with_bonus(self):
        combatants = [{"id": "x", "name": "X", "hp_current": 1, "hp_max": 1, "ac": 10, "initiative_bonus": 10}]
        with patch("app.game_engine.combat.random.randint", return_value=10):
            result = roll_initiative(combatants)
        assert result[0].initiative == 20


class TestResolveAttack:
    def test_hit_when_total_meets_ac(self):
        result = resolve_attack(
            attacker_attack_bonus=5,
            target_ac=15,
            damage_dice="1d8+3",
            roll=10,  # 10 + 5 = 15 >= 15
        )
        assert result.hit is True
        assert result.critical is False
        assert result.damage > 0

    def test_miss_when_total_below_ac(self):
        result = resolve_attack(
            attacker_attack_bonus=2,
            target_ac=15,
            damage_dice="1d8+3",
            roll=5,  # 5 + 2 = 7 < 15
        )
        assert result.hit is False
        assert result.damage == 0

    def test_natural_20_is_critical(self):
        result = resolve_attack(
            attacker_attack_bonus=0,
            target_ac=30,
            damage_dice="1d8",
            roll=20,
        )
        assert result.hit is True
        assert result.critical is True
        assert result.damage > 0

    def test_natural_1_is_auto_miss(self):
        result = resolve_attack(
            attacker_attack_bonus=100,
            target_ac=1,
            damage_dice="1d8",
            roll=1,
        )
        assert result.hit is False
        assert result.damage == 0

    def test_critical_damage_higher_on_average(self):
        normal_samples = [
            resolve_attack(0, 1, "2d6", roll=10).damage
            for _ in range(200)
        ]
        crit_samples = [
            resolve_attack(0, 1, "2d6", roll=20).damage
            for _ in range(200)
        ]
        assert sum(crit_samples) > sum(normal_samples) * 0.8  # crits should be roughly higher

    def test_rolls_d20_when_not_provided(self):
        with patch("app.game_engine.combat.random.randint", return_value=15):
            result = resolve_attack(5, 10, "1d6+2")
        assert result.roll == 15


class TestApplyDamage:
    def test_reduces_hp(self):
        char = make_char(hp=30)
        updated, is_dead = apply_damage(char, 10)
        assert updated.hp_current == 20
        assert is_dead is False

    def test_hp_floored_at_zero(self):
        char = make_char(hp=5)
        updated, _ = apply_damage(char, 100)
        assert updated.hp_current == 0

    def test_enemy_dies_at_zero_hp(self):
        enemy = make_char(char_id="goblin", hp=5)
        _, is_dead = apply_damage(enemy, 10)
        assert is_dead is True

    def test_player_does_not_die_at_zero_hp(self):
        player = make_char(char_id="player", hp=5)
        _, is_dead = apply_damage(player, 10)
        assert is_dead is False  # player enters death save state

    def test_original_unchanged(self):
        char = make_char(hp=30)
        apply_damage(char, 15)
        assert char.hp_current == 30


class TestCheckDeathSaves:
    def test_success_increments(self):
        char = make_char()
        updated = check_death_saves(char, 15)
        assert updated.death_saves["successes"] == 1

    def test_failure_increments(self):
        char = make_char()
        updated = check_death_saves(char, 5)
        assert updated.death_saves["failures"] == 1

    def test_natural_1_adds_two_failures(self):
        char = make_char()
        updated = check_death_saves(char, 1)
        assert updated.death_saves["failures"] == 2

    def test_natural_20_stabilizes_at_1hp(self):
        char = make_char(hp=0)
        updated = check_death_saves(char, 20)
        assert updated.hp_current == 1

    def test_three_failures_adds_dead_condition(self):
        char = make_char()
        char = check_death_saves(char, 1)   # +2 failures
        char = check_death_saves(char, 5)   # +1 failure -> 3
        assert "dead" in char.conditions

    def test_three_successes_adds_stable_condition(self):
        char = make_char()
        char = check_death_saves(char, 15)
        char = check_death_saves(char, 15)
        char = check_death_saves(char, 15)
        assert "stable" in char.conditions

    def test_saves_capped_at_3(self):
        char = make_char()
        char = char.with_changes(death_saves={"successes": 3, "failures": 3})
        updated = check_death_saves(char, 1)
        assert updated.death_saves["failures"] <= 3


class TestCalculateXpReward:
    def test_single_cr1_enemy(self):
        enemies = [{"cr": 1}]
        xp = calculate_xp_reward(enemies, party_level=3)
        assert xp == 200  # 200 * 1.0

    def test_two_enemies_apply_1_5_multiplier(self):
        enemies = [{"cr": 1}, {"cr": 1}]
        xp = calculate_xp_reward(enemies, party_level=3)
        assert xp == int(400 * 1.5)

    def test_empty_list_returns_zero(self):
        assert calculate_xp_reward([], party_level=5) == 0

    def test_group_of_six_applies_2x_multiplier(self):
        enemies = [{"cr": 0.25}] * 6
        xp = calculate_xp_reward(enemies, party_level=2)
        assert xp == int(50 * 6 * 2.0)

    def test_unknown_cr_treated_as_zero(self):
        enemies = [{"cr": 999}]
        xp = calculate_xp_reward(enemies, party_level=1)
        assert xp == 0
