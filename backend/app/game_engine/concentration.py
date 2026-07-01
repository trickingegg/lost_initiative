"""
D&D 5e concentration mechanics.
When a concentrating creature takes damage, it must make a Constitution
saving throw (DC = max(10, half the damage taken)) or lose concentration.
"""

from app.game_engine.character import EngineCharacter
from app.game_engine.conditions import clear_condition, has_condition


def concentration_dc(damage: int) -> int:
    """Concentration saving throw DC = max(10, half the damage taken)."""
    return max(10, damage // 2)


def check_concentration(character: EngineCharacter, damage: int, con_save_roll: int) -> EngineCharacter:
    """
    Check if concentration holds after taking damage.
    Returns the character with concentration cleared if the save fails.
    """
    if not has_condition(character, "concentrating"):
        return character

    dc = concentration_dc(damage)
    if con_save_roll < dc:
        return clear_condition(character, "concentrating")
    return character


def start_concentration(character: EngineCharacter) -> EngineCharacter:
    """Mark the character as concentrating on a spell. Only one at a time."""
    from app.game_engine.conditions import apply_condition
    if has_condition(character, "concentrating"):
        character = clear_condition(character, "concentrating")
    return apply_condition(character, "concentrating")


def end_concentration(character: EngineCharacter) -> EngineCharacter:
    """Voluntarily end concentration."""
    return clear_condition(character, "concentrating")
