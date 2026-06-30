"""
D&D 5e combat mechanics. Pure functions, no AI, no side effects.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field, replace
from typing import Dict, List, Optional, Tuple

from app.game_engine.character import (
    AbilityScores,
    EngineCharacter,
    calculate_modifier,
)
from app.game_engine.dice import roll_damage


# ---------------------------------------------------------------------------
# XP reward by CR (Challenge Rating) per DMG table
# ---------------------------------------------------------------------------
XP_BY_CR: Dict[float, int] = {
    0: 10,
    0.125: 25,
    0.25: 50,
    0.5: 100,
    1: 200,
    2: 450,
    3: 700,
    4: 1100,
    5: 1800,
    6: 2300,
    7: 2900,
    8: 3900,
    9: 5000,
    10: 5900,
    11: 7200,
    12: 8400,
    13: 10000,
    14: 11500,
    15: 13000,
    16: 15000,
    17: 18000,
    18: 20000,
    19: 22000,
    20: 25000,
}

# ---------------------------------------------------------------------------
# Combatant — lightweight; used for initiative order and battle tracking
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Combatant:
    id: str
    name: str
    initiative: int
    hp_current: int
    hp_max: int
    ac: int
    is_player: bool = False


# ---------------------------------------------------------------------------
# Attack result
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class AttackResult:
    hit: bool
    critical: bool
    roll: int           # d20 roll before any modifiers
    total: int          # roll + attack bonus
    damage: int         # 0 on miss
    damage_type: str = "slashing"


# ---------------------------------------------------------------------------
# Initiative
# ---------------------------------------------------------------------------

def roll_initiative(combatants: List[dict]) -> List[Combatant]:
    """
    Roll initiative for each combatant dict.
    Expected dict keys: id, name, hp_current, hp_max, ac, initiative_bonus, is_player (opt).
    Returns list sorted descending by initiative (ties broken randomly).
    """
    rolled: List[Combatant] = []
    for c in combatants:
        base_roll = random.randint(1, 20)
        bonus = c.get("initiative_bonus", 0)
        combatant = Combatant(
            id=c["id"],
            name=c["name"],
            initiative=base_roll + bonus,
            hp_current=c.get("hp_current", c.get("hp", 1)),
            hp_max=c.get("hp_max", c.get("hp", 1)),
            ac=c.get("ac", 10),
            is_player=c.get("is_player", False),
        )
        rolled.append(combatant)

    # Stable descending sort; random tiebreaker via secondary sort key
    rolled.sort(key=lambda x: (x.initiative, random.random()), reverse=True)
    return rolled


# ---------------------------------------------------------------------------
# Attack resolution
# ---------------------------------------------------------------------------

def resolve_attack(
    attacker_attack_bonus: int,
    target_ac: int,
    damage_dice: str,
    roll: Optional[int] = None,
    damage_type: str = "slashing",
) -> AttackResult:
    """
    Resolve a single attack.
    
    Args:
        attacker_attack_bonus: Total attack bonus (prof + ability mod + magic).
        target_ac: Target's Armor Class.
        damage_dice: Damage expression, e.g. '1d8+3'.
        roll: Pre-rolled d20 value (1-20). If None, rolls randomly.
        damage_type: Damage type string.
    
    Returns AttackResult with hit/miss/crit info and damage.
    """
    if roll is None:
        roll = random.randint(1, 20)

    critical = roll == 20
    auto_miss = roll == 1
    total = roll + attacker_attack_bonus

    if auto_miss:
        return AttackResult(hit=False, critical=False, roll=roll, total=total, damage=0,
                            damage_type=damage_type)

    hit = critical or total >= target_ac

    if not hit:
        return AttackResult(hit=False, critical=False, roll=roll, total=total, damage=0,
                            damage_type=damage_type)

    # Critical hit doubles the dice (not the modifier)
    if critical:
        damage = _roll_critical_damage(damage_dice)
    else:
        damage = roll_damage(damage_dice)

    return AttackResult(hit=True, critical=critical, roll=roll, total=total,
                        damage=damage, damage_type=damage_type)


def _roll_critical_damage(damage_dice: str) -> int:
    """Double the dice portion of the expression, keep modifier unchanged."""
    import re
    pattern = re.compile(r"^(\d*)d(\d+)([+-]\d+)?$", re.IGNORECASE)
    expr = damage_dice.strip().replace(" ", "")
    match = pattern.match(expr)
    if not match:
        return roll_damage(damage_dice)

    count_str, sides_str, modifier_str = match.groups()
    count = int(count_str) if count_str else 1
    sides = int(sides_str)
    modifier = int(modifier_str) if modifier_str else 0

    doubled_count = count * 2
    total = sum(random.randint(1, sides) for _ in range(doubled_count)) + modifier
    return max(0, total)


# ---------------------------------------------------------------------------
# Damage application
# ---------------------------------------------------------------------------

def apply_damage(
    target: EngineCharacter,
    damage: int,
    damage_type: str = "slashing",
) -> Tuple[EngineCharacter, bool]:
    """
    Apply damage to a character. Returns (updated_character, is_dead).
    Dead = HP <= 0 AND character has no death save tracking started
          (enemies die immediately; players enter death save state at 0 HP).
    """
    new_hp = max(0, target.hp_current - damage)
    is_dead = new_hp <= 0 and not target.is_player_character()
    updated = target.with_changes(hp_current=new_hp)
    return updated, is_dead


def _is_player_character(char: EngineCharacter) -> bool:
    return char.id == "player"


# Monkey-patch helper onto EngineCharacter for is_dead check
EngineCharacter.is_player_character = lambda self: self.id == "player"


# ---------------------------------------------------------------------------
# Death saves
# ---------------------------------------------------------------------------

def check_death_saves(character: EngineCharacter, roll: int) -> EngineCharacter:
    """
    Process a death saving throw roll.
    20 = stabilize (1 HP). 10-19 = success. 1-9 = failure. 1 = two failures.
    3 successes = stable (unconscious at 0 HP). 3 failures = dead.
    """
    saves = dict(character.death_saves)

    if roll == 20:
        return character.with_changes(
            hp_current=1,
            death_saves={"successes": 0, "failures": 0},
            conditions=tuple(c for c in character.conditions if c != "unconscious"),
        )

    if roll == 1:
        saves["failures"] = min(3, saves.get("failures", 0) + 2)
    elif roll <= 9:
        saves["failures"] = min(3, saves.get("failures", 0) + 1)
    else:
        saves["successes"] = min(3, saves.get("successes", 0) + 1)

    conditions = list(character.conditions)
    if saves.get("failures", 0) >= 3:
        if "dead" not in conditions:
            conditions.append("dead")
    elif saves.get("successes", 0) >= 3:
        # Stable — still unconscious but no longer making saves
        if "stable" not in conditions:
            conditions.append("stable")

    return character.with_changes(
        death_saves=saves,
        conditions=tuple(conditions),
    )


# ---------------------------------------------------------------------------
# XP reward calculation
# ---------------------------------------------------------------------------

def calculate_xp_reward(enemies: List[dict], party_level: int) -> int:
    """
    Calculate total XP awarded for defeating a group of enemies.
    Applies group size multiplier per DMG encounter building rules.

    Each enemy dict should have a 'cr' key (float or int).
    """
    if not enemies:
        return 0

    base_xp = sum(XP_BY_CR.get(float(e.get("cr", 0)), 0) for e in enemies)
    count = len(enemies)

    if count == 1:
        multiplier = 1.0
    elif count == 2:
        multiplier = 1.5
    elif count <= 6:
        multiplier = 2.0
    elif count <= 10:
        multiplier = 2.5
    elif count <= 14:
        multiplier = 3.0
    else:
        multiplier = 4.0

    return int(base_xp * multiplier)
