"""
Pydantic schemas for Gemini structured output.
These are the types the AI GM must return as validated JSON.
"""
from __future__ import annotations

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class RollRequest(BaseModel):
    type: Literal["ABILITY_CHECK", "SAVING_THROW", "ATTACK_ROLL"]
    ability: str
    dc: int
    reason: str


class CombatantDamage(BaseModel):
    id: str
    amount: int = Field(default=0, ge=0)


class StateChanges(BaseModel):
    damage: Optional[int] = None
    heal: Optional[int] = None
    add_xp: Optional[int] = None
    add_items: List[dict] = Field(default_factory=list)
    remove_items: List[dict] = Field(default_factory=list)
    start_battle: Optional[List[dict]] = None
    end_battle: bool = False
    await_roll: Optional[RollRequest] = None
    quest_update: Optional[dict] = None
    long_rest: bool = False
    short_rest: bool = False
    set_condition: Optional[str] = None
    clear_condition: Optional[str] = None
    cast_spell: Optional[dict] = None
    use_ki: Optional[int] = None
    combatant_damage: List[CombatantDamage] = Field(default_factory=list)


class GMResponse(BaseModel):
    narrative: str
    state_changes: StateChanges = Field(default_factory=StateChanges)
    image_prompt: Optional[str] = None
    image_key: Optional[str] = None
    internal_gm_notes: str = ""
    suggested_actions: List[str] = Field(default_factory=list)
