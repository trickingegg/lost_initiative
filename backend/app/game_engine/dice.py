"""
Pure D&D dice mechanics. No AI, no side effects — all pure functions.
"""
import random
import re
from typing import List


def roll(sides: int, count: int = 1) -> List[int]:
    """Roll `count` dice with `sides` faces. Returns list of individual results."""
    if sides < 2:
        raise ValueError(f"Dice must have at least 2 sides, got {sides}")
    if count < 1:
        raise ValueError(f"Must roll at least 1 die, got {count}")
    return [random.randint(1, sides) for _ in range(count)]


def roll_with_advantage(sides: int) -> int:
    """Roll two dice, take the higher result."""
    a, b = random.randint(1, sides), random.randint(1, sides)
    return max(a, b)


def roll_with_disadvantage(sides: int) -> int:
    """Roll two dice, take the lower result."""
    a, b = random.randint(1, sides), random.randint(1, sides)
    return min(a, b)


# Pattern: optional count d sides optional modifier, e.g. "2d6+3", "d8", "1d4-1"
_DICE_PATTERN = re.compile(r"^(\d*)d(\d+)([+-]\d+)?$", re.IGNORECASE)


def roll_damage(expression: str) -> int:
    """
    Parse and evaluate a standard dice expression such as '2d6+3', 'd8', '1d4-1'.
    Returns the total rolled value (minimum 0 after modifier).
    """
    expr = expression.strip().replace(" ", "")
    match = _DICE_PATTERN.match(expr)
    if not match:
        raise ValueError(f"Invalid dice expression: '{expression}'")

    count_str, sides_str, modifier_str = match.groups()
    count = int(count_str) if count_str else 1
    sides = int(sides_str)
    modifier = int(modifier_str) if modifier_str else 0

    total = sum(roll(sides, count)) + modifier
    return max(0, total)


def roll_d20() -> int:
    return random.randint(1, 20)


def roll_d20_advantage() -> int:
    return roll_with_advantage(20)


def roll_d20_disadvantage() -> int:
    return roll_with_disadvantage(20)
