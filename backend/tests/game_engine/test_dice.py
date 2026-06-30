"""Tests for game_engine/dice.py"""
import pytest
from unittest.mock import patch

from app.game_engine.dice import (
    roll,
    roll_with_advantage,
    roll_with_disadvantage,
    roll_damage,
    roll_d20,
    roll_d20_advantage,
    roll_d20_disadvantage,
)


class TestRoll:
    def test_single_die_within_range(self):
        for _ in range(50):
            result = roll(6)
            assert len(result) == 1
            assert 1 <= result[0] <= 6

    def test_multiple_dice(self):
        results = roll(8, 4)
        assert len(results) == 4
        for r in results:
            assert 1 <= r <= 8

    def test_d20_range(self):
        for _ in range(100):
            result = roll(20)
            assert 1 <= result[0] <= 20

    def test_invalid_sides_raises(self):
        with pytest.raises(ValueError):
            roll(1)

    def test_invalid_count_raises(self):
        with pytest.raises(ValueError):
            roll(6, 0)


class TestAdvantageDisadvantage:
    def test_advantage_returns_higher(self):
        with patch("app.game_engine.dice.random.randint", side_effect=[5, 15]):
            result = roll_with_advantage(20)
        assert result == 15

    def test_disadvantage_returns_lower(self):
        with patch("app.game_engine.dice.random.randint", side_effect=[5, 15]):
            result = roll_with_disadvantage(20)
        assert result == 5

    def test_advantage_within_range(self):
        for _ in range(50):
            result = roll_with_advantage(20)
            assert 1 <= result <= 20

    def test_disadvantage_within_range(self):
        for _ in range(50):
            result = roll_with_disadvantage(20)
            assert 1 <= result <= 20


class TestRollDamage:
    def test_simple_expression(self):
        for _ in range(20):
            result = roll_damage("2d6")
            assert 2 <= result <= 12

    def test_expression_with_positive_modifier(self):
        for _ in range(20):
            result = roll_damage("1d8+3")
            assert 4 <= result <= 11

    def test_expression_with_negative_modifier(self):
        for _ in range(20):
            result = roll_damage("1d4-1")
            assert 0 <= result <= 3

    def test_expression_without_count(self):
        for _ in range(20):
            result = roll_damage("d6")
            assert 1 <= result <= 6

    def test_known_roll_with_mock(self):
        with patch("app.game_engine.dice.random.randint", return_value=4):
            result = roll_damage("2d6+3")
        assert result == 11  # 4+4+3

    def test_minimum_zero_with_heavy_negative(self):
        with patch("app.game_engine.dice.random.randint", return_value=1):
            result = roll_damage("1d4-10")
        assert result == 0

    def test_invalid_expression_raises(self):
        with pytest.raises(ValueError):
            roll_damage("notadice")

    def test_invalid_expression_with_spaces_raises(self):
        with pytest.raises(ValueError):
            roll_damage("abc")

    def test_case_insensitive(self):
        for _ in range(10):
            result = roll_damage("2D6")
            assert 2 <= result <= 12


class TestD20Helpers:
    def test_roll_d20_range(self):
        for _ in range(100):
            assert 1 <= roll_d20() <= 20

    def test_roll_d20_advantage_uses_advantage(self):
        with patch("app.game_engine.dice.random.randint", side_effect=[3, 18]):
            assert roll_d20_advantage() == 18

    def test_roll_d20_disadvantage_uses_disadvantage(self):
        with patch("app.game_engine.dice.random.randint", side_effect=[3, 18]):
            assert roll_d20_disadvantage() == 3
