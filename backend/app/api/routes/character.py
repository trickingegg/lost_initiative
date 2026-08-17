"""
Character creation and lookup endpoints.
"""
from __future__ import annotations

from typing import Dict, List

from fastapi import APIRouter

from app.game_engine.character import (
    calculate_ac,
    calculate_modifier,
    calculate_proficiency_bonus,
    AbilityScores as EngineAbilityScores,
    EngineCharacter,
)
from app.game_engine.spells import build_initial_spell_slots, get_spell_slots_for_level
from app.models.domain import AbilityScores, Character, SpellSlot

router = APIRouter(prefix="/character", tags=["character"])


@router.post("/create", response_model=Character)
async def create_character(character: Character) -> Character:
    """
    Accept a character definition, compute derived stats, return the completed Character.
    """
    prof_bonus = calculate_proficiency_bonus(character.level)

    # Build engine character to compute AC
    ec = EngineCharacter(
        id=character.id,
        name=character.name,
        race=character.race,
        char_class=character.char_class,
        level=character.level,
        xp=character.xp,
        hp_current=character.hp_current,
        hp_max=character.hp_max,
        abilities=EngineAbilityScores(
            strength=character.abilities.strength,
            dexterity=character.abilities.dexterity,
            constitution=character.abilities.constitution,
            intelligence=character.abilities.intelligence,
            wisdom=character.abilities.wisdom,
            charisma=character.abilities.charisma,
        ),
        proficiency_bonus=prof_bonus,
        skills=tuple(character.skills),
        inventory=tuple(
            {"name": item.name, "quantity": item.quantity} for item in character.inventory
        ),
        spell_slots={},
        death_saves={"successes": 0, "failures": 0},
        hit_dice_current=character.level,
        hit_dice_max=character.level,
    )

    computed_ac = calculate_ac(ec)

    # Build spell slots if not explicitly set
    spell_slots = character.spell_slots
    if not spell_slots:
        raw_slots = build_initial_spell_slots(character.char_class, character.level)
        spell_slots = {lvl: SpellSlot(current=s.current, maximum=s.maximum)
                       for lvl, s in raw_slots.items()}

    return character.model_copy(update={
        "proficiency_bonus": prof_bonus,
        "ac": computed_ac if character.ac == 0 else character.ac,
        "spell_slots": spell_slots,
        "hit_dice_current": character.hit_dice_current if character.hit_dice_current is not None else character.level,
        "hit_dice_max": character.hit_dice_max if character.hit_dice_max is not None else character.level,
    })


@router.get("/classes", response_model=List[str])
async def list_classes() -> List[str]:
    return ["Fighter", "Wizard", "Rogue", "Cleric", "Monk", "Necromancer"]


@router.get("/races", response_model=List[str])
async def list_races() -> List[str]:
    return ["Human", "Elf", "Dwarf", "Halfling", "Half-Elf", "Tiefling"]


@router.get("/conditions")
async def list_conditions() -> Dict[str, str]:
    from app.game_engine.conditions import CONDITION_DESCRIPTIONS

    return dict(CONDITION_DESCRIPTIONS)


@router.get("/ability-modifier/{score}", response_model=Dict[str, int])
async def get_modifier(score: int) -> Dict[str, int]:
    return {"score": score, "modifier": calculate_modifier(score)}
