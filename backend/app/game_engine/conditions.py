"""
D&D 5e conditions. All 14 official conditions plus engine-internal states.
Pure functions, no AI, no side effects.
"""
from __future__ import annotations

from typing import Dict, FrozenSet, List, Optional, Tuple

from app.game_engine.character import EngineCharacter

# ---------------------------------------------------------------------------
# Official D&D 5e conditions (SRD)
# ---------------------------------------------------------------------------

CONDITION_DESCRIPTIONS: Dict[str, str] = {
    "blinded": (
        "A blinded creature can't see and automatically fails any ability check that "
        "requires sight. Attack rolls against the creature have advantage, and the "
        "creature's attack rolls have disadvantage."
    ),
    "charmed": (
        "A charmed creature can't attack the charmer or target the charmer with harmful "
        "abilities or magical effects. The charmer has advantage on any ability check to "
        "interact socially with the creature."
    ),
    "deafened": (
        "A deafened creature can't hear and automatically fails any ability check that "
        "requires hearing."
    ),
    "exhaustion": (
        "Exhaustion is measured in six levels. Each level imposes cumulative penalties: "
        "1=disadvantage on ability checks; 2=speed halved; 3=disadvantage on attacks and "
        "saves; 4=speed reduced to 0; 5=disadvantage on death saves; 6=death."
    ),
    "frightened": (
        "A frightened creature has disadvantage on ability checks and attack rolls while "
        "the source of its fear is within line of sight. The creature can't willingly move "
        "closer to the source of its fear."
    ),
    "grappled": (
        "A grappled creature's speed becomes 0, and it can't benefit from any bonus to "
        "its speed. The condition ends if the grappler is incapacitated or if the grappled "
        "creature is removed from reach."
    ),
    "incapacitated": (
        "An incapacitated creature can't take actions or reactions."
    ),
    "invisible": (
        "An invisible creature is impossible to see without special senses. Attack rolls "
        "against the invisible creature have disadvantage, and the creature's attack rolls "
        "have advantage."
    ),
    "paralyzed": (
        "A paralyzed creature is incapacitated, can't move, and can't speak. Attack rolls "
        "against the creature have advantage. Any attack that hits the creature is a "
        "critical hit if the attacker is within 5 feet of the creature."
    ),
    "petrified": (
        "A petrified creature is transformed, along with any nonmagical objects it is "
        "wearing or carrying, into a solid inanimate substance. It is incapacitated, "
        "doesn't age, and is immune to poison and disease."
    ),
    "poisoned": (
        "A poisoned creature has disadvantage on attack rolls and ability checks."
    ),
    "prone": (
        "A prone creature's only movement option is to crawl. Standing up costs half of "
        "the creature's speed. Melee attack rolls against the creature have advantage; "
        "ranged attack rolls have disadvantage. The creature has disadvantage on its "
        "own attack rolls."
    ),
    "restrained": (
        "A restrained creature's speed becomes 0. Attack rolls against the creature have "
        "advantage, and the creature's attack rolls have disadvantage. The creature has "
        "disadvantage on Dexterity saving throws."
    ),
    "stunned": (
        "A stunned creature is incapacitated, can't move, and can speak only falteringly. "
        "Attack rolls against the creature have advantage. The creature automatically fails "
        "Strength and Dexterity saving throws."
    ),
    "unconscious": (
        "An unconscious creature is incapacitated, can't move or speak, and is unaware of "
        "its surroundings. Attack rolls against the creature have advantage. Any attack that "
        "hits is a critical hit if the attacker is within 5 feet."
    ),
    # Engine-internal states (not official conditions but tracked similarly)
    "dead": "The creature is dead.",
    "stable": "The creature is unconscious but no longer making death saving throws.",
    "concentrating": "The creature is maintaining concentration on a spell.",
}

ALL_CONDITIONS: FrozenSet[str] = frozenset(CONDITION_DESCRIPTIONS.keys())

# Conditions that imply incapacitation (relevant for combat logic)
INCAPACITATING_CONDITIONS: FrozenSet[str] = frozenset({
    "incapacitated", "paralyzed", "petrified", "stunned", "unconscious", "dead",
})

# Conditions that grant attackers advantage against the target
GRANTS_ATTACKER_ADVANTAGE: FrozenSet[str] = frozenset({
    "blinded", "paralyzed", "petrified", "prone", "restrained", "stunned", "unconscious",
})

# Conditions that impose disadvantage on the creature's own attack rolls
IMPOSES_ATTACK_DISADVANTAGE: FrozenSet[str] = frozenset({
    "blinded", "frightened", "poisoned", "prone", "restrained",
})


# ---------------------------------------------------------------------------
# Condition application / removal
# ---------------------------------------------------------------------------

def apply_condition(character: EngineCharacter, condition: str) -> EngineCharacter:
    """
    Add a condition to the character if not already present.
    Condition name is normalized to lowercase.
    Raises ValueError for unknown conditions.
    """
    normalized = condition.lower().strip()
    if normalized not in ALL_CONDITIONS:
        raise ValueError(f"Unknown condition: '{condition}'")

    if normalized in character.conditions:
        return character  # idempotent

    new_conditions = tuple(character.conditions) + (normalized,)
    return character.with_changes(conditions=new_conditions)


def clear_condition(character: EngineCharacter, condition: str) -> EngineCharacter:
    """Remove a condition from the character. Idempotent — no error if absent."""
    normalized = condition.lower().strip()
    new_conditions = tuple(c for c in character.conditions if c != normalized)
    return character.with_changes(conditions=new_conditions)


def clear_all_conditions(character: EngineCharacter) -> EngineCharacter:
    """Remove all conditions (e.g. after a magical cure-all)."""
    return character.with_changes(conditions=())


def get_condition_description(condition: str) -> str:
    """Return the rules description for a condition. Raises ValueError if unknown."""
    normalized = condition.lower().strip()
    if normalized not in CONDITION_DESCRIPTIONS:
        raise ValueError(f"Unknown condition: '{condition}'")
    return CONDITION_DESCRIPTIONS[normalized]


# ---------------------------------------------------------------------------
# Combat helpers derived from conditions
# ---------------------------------------------------------------------------

def attacker_has_advantage_vs(target: EngineCharacter) -> bool:
    """Return True if any of the target's conditions grant attackers advantage."""
    return bool(set(target.conditions) & GRANTS_ATTACKER_ADVANTAGE)


def creature_has_attack_disadvantage(character: EngineCharacter) -> bool:
    """Return True if any of the character's conditions impose attack disadvantage."""
    return bool(set(character.conditions) & IMPOSES_ATTACK_DISADVANTAGE)


def is_incapacitated(character: EngineCharacter) -> bool:
    """Return True if the character is effectively incapacitated."""
    return bool(set(character.conditions) & INCAPACITATING_CONDITIONS)


def has_condition(character: EngineCharacter, condition: str) -> bool:
    return condition.lower().strip() in character.conditions
