"""
Character mechanics for D&D 5e. Pure functions, no AI, no side effects.
All mutations return new objects — never modify in place.
"""
from __future__ import annotations

from dataclasses import dataclass, field, replace
from typing import Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# XP thresholds: index = current level, value = total XP needed to reach it.
# Level 1 requires 0 XP. Levels go up to 20.
# ---------------------------------------------------------------------------
XP_THRESHOLDS: List[int] = [
    0,       # Level 1
    300,     # Level 2
    900,     # Level 3
    2700,    # Level 4
    6500,    # Level 5
    14000,   # Level 6
    23000,   # Level 7
    34000,   # Level 8
    48000,   # Level 9
    64000,   # Level 10
    85000,   # Level 11
    100000,  # Level 12
    120000,  # Level 13
    140000,  # Level 14
    165000,  # Level 15
    195000,  # Level 16
    225000,  # Level 17
    265000,  # Level 18
    305000,  # Level 19
    355000,  # Level 20
]

MAX_LEVEL = 20

# Armor class base values for armor types
ARMOR_AC: Dict[str, int] = {
    # Light
    "Padded Armor": 11,
    "Leather Armor": 11,
    "Studded Leather Armor": 12,
    # Medium
    "Hide Armor": 12,
    "Chain Shirt": 13,
    "Scale Mail": 14,
    "Breastplate": 14,
    "Half Plate": 15,
    # Heavy
    "Ring Mail": 14,
    "Chain Mail": 16,
    "Splint Armor": 17,
    "Plate Armor": 18,
}

LIGHT_ARMOR = {"Padded Armor", "Leather Armor", "Studded Leather Armor"}
MEDIUM_ARMOR = {"Hide Armor", "Chain Shirt", "Scale Mail", "Breastplate", "Half Plate"}
HEAVY_ARMOR = {"Ring Mail", "Chain Mail", "Splint Armor", "Plate Armor"}
SHIELD_BONUS = 2

# Skill -> governing ability mapping
SKILL_ABILITY: Dict[str, str] = {
    "Acrobatics": "dexterity",
    "Animal Handling": "wisdom",
    "Arcana": "intelligence",
    "Athletics": "strength",
    "Deception": "charisma",
    "History": "intelligence",
    "Insight": "wisdom",
    "Intimidation": "charisma",
    "Investigation": "intelligence",
    "Medicine": "wisdom",
    "Nature": "intelligence",
    "Perception": "wisdom",
    "Performance": "charisma",
    "Persuasion": "charisma",
    "Religion": "intelligence",
    "Sleight of Hand": "dexterity",
    "Stealth": "dexterity",
    "Survival": "wisdom",
}

# Hit dice by class name (lower-cased)
HIT_DIE_BY_CLASS: Dict[str, int] = {
    "fighter": 10,
    "wizard": 6,
    "rogue": 8,
    "cleric": 8,
    "monk": 8,
    "necromancer": 6,
    "barbarian": 12,
    "paladin": 10,
    "ranger": 10,
    "sorcerer": 6,
    "warlock": 8,
    "bard": 8,
    "druid": 8,
}


# ---------------------------------------------------------------------------
# Lightweight dataclasses used by the game engine (separate from Pydantic models).
# These avoid the overhead of Pydantic validation inside tight combat loops.
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class AbilityScores:
    strength: int = 10
    dexterity: int = 10
    constitution: int = 10
    intelligence: int = 10
    wisdom: int = 10
    charisma: int = 10


@dataclass(frozen=True)
class SpellSlot:
    current: int
    maximum: int


@dataclass(frozen=True)
class EngineCharacter:
    """Lightweight immutable character used inside game_engine calculations."""
    id: str
    name: str
    race: str
    char_class: str
    level: int
    xp: int
    hp_current: int
    hp_max: int
    abilities: AbilityScores
    proficiency_bonus: int
    skills: Tuple[str, ...] = field(default_factory=tuple)
    features: Tuple[dict, ...] = field(default_factory=tuple)
    inventory: Tuple[dict, ...] = field(default_factory=tuple)
    spell_slots: Dict[int, SpellSlot] = field(default_factory=dict)
    ki_current: Optional[int] = None
    ki_max: Optional[int] = None
    conditions: Tuple[str, ...] = field(default_factory=tuple)
    death_saves: Dict[str, int] = field(default_factory=lambda: {"successes": 0, "failures": 0})
    exhaustion: int = 0

    def with_changes(self, **kwargs) -> "EngineCharacter":
        return replace(self, **kwargs)


@dataclass(frozen=True)
class LevelUpChoices:
    new_level: int
    hp_increase: int
    proficiency_bonus: int
    new_features: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Pure calculation functions
# ---------------------------------------------------------------------------

def calculate_modifier(score: int) -> int:
    """Standard D&D 5e ability modifier: floor((score - 10) / 2)."""
    return (score - 10) // 2


def calculate_proficiency_bonus(level: int) -> int:
    """
    Proficiency bonus table per D&D 5e:
    Levels 1-4: +2, 5-8: +3, 9-12: +4, 13-16: +5, 17-20: +6
    """
    if level < 1 or level > MAX_LEVEL:
        raise ValueError(f"Level must be between 1 and {MAX_LEVEL}, got {level}")
    return 2 + (level - 1) // 4


def calculate_ac(character: EngineCharacter) -> int:
    """
    Determine AC from inventory.
    Priority: worn armor (best found) + optional shield bonus.
    If no armor: 10 + DEX modifier (unarmored).
    Monk unarmored defense: 10 + DEX + WIS (detected via class name).
    """
    dex_mod = calculate_modifier(character.abilities.dexterity)
    wis_mod = calculate_modifier(character.abilities.wisdom)
    con_mod = calculate_modifier(character.abilities.constitution)

    worn_armor: Optional[str] = None
    has_shield = False

    for item in character.inventory:
        name = item.get("name", "")
        if name in ARMOR_AC:
            # Pick the best armor if multiple worn (edge case)
            if worn_armor is None or ARMOR_AC[name] > ARMOR_AC[worn_armor]:
                worn_armor = name
        if "Shield" in name:
            has_shield = True

    shield_bonus = SHIELD_BONUS if has_shield else 0

    if worn_armor is None:
        # Unarmored
        if character.char_class.lower() == "monk":
            base = 10 + dex_mod + wis_mod
        elif character.char_class.lower() == "barbarian":
            base = 10 + dex_mod + con_mod
        else:
            base = 10 + dex_mod
        return base + shield_bonus

    armor_name = worn_armor
    base_ac = ARMOR_AC[armor_name]

    if armor_name in LIGHT_ARMOR:
        return base_ac + dex_mod + shield_bonus
    if armor_name in MEDIUM_ARMOR:
        return base_ac + min(dex_mod, 2) + shield_bonus
    # Heavy armor — no DEX bonus
    return base_ac + shield_bonus


def calculate_skill_bonus(character: EngineCharacter, skill: str) -> int:
    """
    Total skill bonus = ability modifier + proficiency bonus (if proficient).
    """
    ability_name = SKILL_ABILITY.get(skill)
    if ability_name is None:
        raise ValueError(f"Unknown skill: '{skill}'")

    ability_score = getattr(character.abilities, ability_name)
    mod = calculate_modifier(ability_score)
    proficient = skill in character.skills
    return mod + (character.proficiency_bonus if proficient else 0)


def apply_long_rest(character: EngineCharacter) -> EngineCharacter:
    """
    Long rest: restore full HP, all spell slots, all Ki points.
    Death saves reset on any rest after stabilization (handled here too).
    """
    # Restore spell slots
    restored_slots: Dict[int, SpellSlot] = {
        lvl: SpellSlot(current=slot.maximum, maximum=slot.maximum)
        for lvl, slot in character.spell_slots.items()
    }

    return character.with_changes(
        hp_current=character.hp_max,
        spell_slots=restored_slots,
        ki_current=character.ki_max if character.ki_max is not None else None,
        death_saves={"successes": 0, "failures": 0},
    )


def apply_short_rest(character: EngineCharacter, hit_dice_spent: int) -> EngineCharacter:
    """
    Short rest: spend hit dice to recover HP. Each hit die heals hit_die + CON modifier HP.
    Warlock spell slots also restore on short rest — handled in spells.py.
    """
    if hit_dice_spent < 0:
        raise ValueError("hit_dice_spent cannot be negative")

    hit_die = HIT_DIE_BY_CLASS.get(character.char_class.lower(), 8)
    con_mod = calculate_modifier(character.abilities.constitution)

    import random as _random
    total_heal = 0
    for _ in range(hit_dice_spent):
        total_heal += max(1, _random.randint(1, hit_die) + con_mod)

    new_hp = min(character.hp_max, character.hp_current + total_heal)
    return character.with_changes(hp_current=new_hp)


def level_up(character: EngineCharacter) -> Tuple[EngineCharacter, LevelUpChoices]:
    """
    Advance character by one level. Returns updated character and LevelUpChoices.
    HP increase = hit_die / 2 + 1 (average) + CON modifier (standard leveling rule).
    """
    if character.level >= MAX_LEVEL:
        raise ValueError(f"Character is already at max level {MAX_LEVEL}")

    new_level = character.level + 1
    new_prof_bonus = calculate_proficiency_bonus(new_level)
    hit_die = HIT_DIE_BY_CLASS.get(character.char_class.lower(), 8)
    con_mod = calculate_modifier(character.abilities.constitution)
    hp_increase = max(1, hit_die // 2 + 1 + con_mod)

    choices = LevelUpChoices(
        new_level=new_level,
        hp_increase=hp_increase,
        proficiency_bonus=new_prof_bonus,
        new_features=[],
    )

    updated = character.with_changes(
        level=new_level,
        proficiency_bonus=new_prof_bonus,
        hp_max=character.hp_max + hp_increase,
        hp_current=character.hp_current + hp_increase,
    )
    return updated, choices


def get_level_for_xp(xp: int) -> int:
    """Return the character level corresponding to the given XP total."""
    level = 1
    for i, threshold in enumerate(XP_THRESHOLDS):
        if xp >= threshold:
            level = i + 1
        else:
            break
    return min(level, MAX_LEVEL)
