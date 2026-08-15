"""
Pydantic v2 domain models. These are the "source of truth" objects
used by API layer, AI GM layer, and persistence layer.
They are distinct from the lightweight EngineCharacter dataclasses
used inside game_engine for performance.
"""
from __future__ import annotations

from typing import Dict, List, Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Primitives
# ---------------------------------------------------------------------------

class AbilityScores(BaseModel):
    strength: int = 10
    dexterity: int = 10
    constitution: int = 10
    intelligence: int = 10
    wisdom: int = 10
    charisma: int = 10


class SpellSlot(BaseModel):
    current: int
    maximum: int


class ChatMessage(BaseModel):
    role: Literal["player", "gm", "system"]
    content: str


class Item(BaseModel):
    name: str
    quantity: int = 1
    description: Optional[str] = None


class Quest(BaseModel):
    title: str
    description: str
    status: Literal["active", "completed", "failed"] = "active"


class Feature(BaseModel):
    name: str
    description: str


class DeathSaves(BaseModel):
    successes: int = 0
    failures: int = 0


# ---------------------------------------------------------------------------
# Character
# ---------------------------------------------------------------------------

class Character(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    race: str
    char_class: str
    subclass: Optional[str] = None
    background: str
    level: int = 1
    xp: int = 0
    hp_current: int
    hp_max: int
    ac: int
    speed: int = 30
    abilities: AbilityScores = Field(default_factory=AbilityScores)
    proficiency_bonus: int = 2
    skills: List[str] = Field(default_factory=list)
    features: List[Feature] = Field(default_factory=list)
    inventory: List[Item] = Field(default_factory=list)
    spells_known: List[str] = Field(default_factory=list)
    spell_slots: Dict[int, SpellSlot] = Field(default_factory=dict)
    ki_current: Optional[int] = None
    ki_max: Optional[int] = None
    conditions: List[str] = Field(default_factory=list)
    death_saves: DeathSaves = Field(default_factory=DeathSaves)
    quests: List[Quest] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Battle state
# ---------------------------------------------------------------------------

class Combatant(BaseModel):
    id: str
    name: str
    hp_current: int
    hp_max: int
    ac: int
    initiative: int = 0
    initiative_bonus: int = 0
    cr: float = 0.0
    is_player: bool = False


class BattleState(BaseModel):
    combatants: List[Combatant] = Field(default_factory=list)
    turn_order: List[str] = Field(default_factory=list)  # sorted combatant IDs
    current_turn_index: int = 0
    round_number: int = 1


class CombatantDamage(BaseModel):
    """Damage to a non-player combatant in the current battle, keyed by combatant id."""
    id: str
    amount: int = Field(ge=0)


class PendingLevelUp(BaseModel):
    """Mechanical level-up already applied (HP, proficiency). UI choices come later."""
    new_level: int
    hp_increase: int
    proficiency_bonus: int
    new_features: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Memory event (long-term GM memory)
# ---------------------------------------------------------------------------

class MemoryEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    event: str
    turn: int
    tags: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Game session
# ---------------------------------------------------------------------------

class GameSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    character: Character
    setting: str
    story_template: Literal[
        "three_act", "hex_crawl", "dungeon_delve", "political_intrigue"
    ] = "dungeon_delve"
    chat_history: List[ChatMessage] = Field(default_factory=list)
    battle_state: Optional[BattleState] = None
    world_events: List[dict] = Field(default_factory=list)
    gm_internal_notes: str = ""
    images_cache: Dict[str, str] = Field(default_factory=dict)
    turn_count: int = 0
    memory_events: List[MemoryEvent] = Field(default_factory=list)
    pending_level_up: Optional[PendingLevelUp] = None


# ---------------------------------------------------------------------------
# AI GM structured output schemas
# ---------------------------------------------------------------------------

class RollRequest(BaseModel):
    type: Literal["ABILITY_CHECK", "SAVING_THROW", "ATTACK_ROLL"]
    ability: str
    dc: int
    reason: str


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


# ---------------------------------------------------------------------------
# API request/response shapes
# ---------------------------------------------------------------------------

class CreateSessionRequest(BaseModel):
    character: Character
    setting: str
    story_template: Literal[
        "three_act", "hex_crawl", "dungeon_delve", "political_intrigue"
    ] = "dungeon_delve"


class PlayerActionRequest(BaseModel):
    action: str
    session_id: str


class RollResultRequest(BaseModel):
    roll: int
    session_id: str
    natural: Optional[int] = None  # d20 face, used for crit 1/20 system lines


class SaveSlotInfo(BaseModel):
    slot: int
    character_name: str
    turn_count: int
    saved_at: str


class SaveSlotsResponse(BaseModel):
    slots: List[SaveSlotInfo]


class RestRequest(BaseModel):
    type: Literal["short", "long"]
    hit_dice_spent: int = 0  # only relevant for short rest


class SaveSlotRequest(BaseModel):
    slot: int = Field(ge=1, le=3)


class LoadSlotRequest(BaseModel):
    slot: int = Field(ge=1, le=3)


class SessionResponse(BaseModel):
    session: GameSession
    last_gm_response: Optional[GMResponse] = None


class ActionResponse(BaseModel):
    session: GameSession
    gm_response: GMResponse
