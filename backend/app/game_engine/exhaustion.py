"""
D&D 5e exhaustion levels (1-6) with cumulative penalties.
Per 2014 PHB rules:
  Level 1 — disadvantage on ability checks
  Level 2 — speed halved
  Level 3 — disadvantage on attack rolls and saving throws
  Level 4 — hit point maximum halved
  Level 5 — speed reduced to 0
  Level 6 — death

Note: exhaustion is tracked as a numeric level (stored in a character field),
not as a condition. The EngineCharacter dataclass doesn't have an exhaustion
field yet, so we add it and manage it through utility functions.
"""

from app.game_engine.character import EngineCharacter


MAX_EXHAUSTION = 6

EXHAUSTION_PENALTIES: dict[int, dict[str, str | int]] = {
    1: {"description": "Disadvantage on ability checks"},
    2: {"description": "Speed halved", "speed_multiplier": 0.5},
    3: {"description": "Disadvantage on attack rolls and saving throws"},
    4: {"description": "Hit point maximum halved", "hp_max_multiplier": 0.5},
    5: {"description": "Speed reduced to 0", "speed_multiplier": 0},
    6: {"description": "Death"},
}


def apply_exhaustion(character: EngineCharacter, level_increase: int = 1) -> EngineCharacter:
    """
    Increase exhaustion by `level_increase` levels (default 1).
    Returns the character with updated exhaustion. Level 6 = death.
    """
    current = _get_exhaustion(character)
    new_level = min(current + level_increase, MAX_EXHAUSTION)
    character = character.with_changes(exhaustion=new_level)
    if new_level >= 6:
        from app.game_engine.conditions import apply_condition
        character = apply_condition(character, "dead")
    return character


def clear_exhaustion(character: EngineCharacter) -> EngineCharacter:
    """Remove all exhaustion levels (e.g., after greater restoration or long rest)."""
    return character.with_changes(exhaustion=0)


def reduce_exhaustion(character: EngineCharacter, levels: int = 1) -> EngineCharacter:
    """Reduce exhaustion by N levels. Cannot go below 0."""
    current = _get_exhaustion(character)
    return character.with_changes(exhaustion=max(0, current - levels))


def get_exhaustion_level(character: EngineCharacter) -> int:
    """Return current exhaustion level (0 means no exhaustion)."""
    return _get_exhaustion(character)


def get_effective_speed(character: EngineCharacter, base_speed: int) -> int:
    """Calculate effective speed after exhaustion penalties (cumulative)."""
    level = _get_exhaustion(character)
    if level < 2:
        return base_speed
    if level >= 5:
        return 0
    return int(base_speed * 0.5)


def get_effective_hp_max(character: EngineCharacter) -> int:
    """Calculate effective max HP after exhaustion penalties (cumulative)."""
    level = _get_exhaustion(character)
    if level < 4:
        return character.hp_max
    return int(character.hp_max * 0.5)


def has_exhaustion_penalty(character: EngineCharacter, penalty_type: str) -> bool:
    """Check if the character has a specific exhaustion penalty active.
    penalty_type: 'ability_checks', 'speed', 'attacks_saves', 'hp_max', 'death'
    """
    level = _get_exhaustion(character)
    if level == 0:
        return False
    return level >= _penalty_min_level(penalty_type)


def _penalty_min_level(penalty_type: str) -> int:
    mapping = {"ability_checks": 1, "speed": 2, "attacks_saves": 3, "hp_max": 4, "death": 6}
    return mapping.get(penalty_type, 99)


def _get_exhaustion(character: EngineCharacter) -> int:
    return getattr(character, "exhaustion", 0)
