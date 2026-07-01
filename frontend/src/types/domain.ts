/** Domain types matching backend Pydantic models (app/models/domain.py). */

// ── Primitives ──

export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface SpellSlot {
  current: number;
  maximum: number;
}

export type MessageRole = "player" | "gm" | "system";

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface Item {
  name: string;
  quantity: number;
  description?: string;
}

export type QuestStatus = "active" | "completed" | "failed";

export interface Quest {
  title: string;
  description: string;
  status: QuestStatus;
}

export interface Feature {
  name: string;
  description: string;
}

export interface DeathSaves {
  successes: number;
  failures: number;
}

// ── Character ──

export interface Character {
  id: string;
  name: string;
  race: string;
  char_class: string;
  subclass?: string;
  background: string;
  level: number;
  xp: number;
  hp_current: number;
  hp_max: number;
  ac: number;
  speed: number;
  abilities: AbilityScores;
  proficiency_bonus: number;
  skills: string[];
  features: Feature[];
  inventory: Item[];
  spells_known: string[];
  spell_slots: Record<number, SpellSlot>;
  ki_current?: number;
  ki_max?: number;
  conditions: string[];
  death_saves: DeathSaves;
  exhaustion: number;
  quests: Quest[];
}

// ── Battle state ──

export interface Combatant {
  id: string;
  name: string;
  hp_current: number;
  hp_max: number;
  ac: number;
  initiative: number;
  initiative_bonus: number;
  cr: number;
  is_player: boolean;
}

export interface BattleState {
  combatants: Combatant[];
  turn_order: string[];
  current_turn_index: number;
  round_number: number;
}

// ── Memory ──

export interface MemoryEvent {
  id: string;
  event: string;
  turn: number;
  tags: string[];
}

// ── Game session ──

export type StoryTemplate =
  | "three_act"
  | "hex_crawl"
  | "dungeon_delve"
  | "political_intrigue";

export interface GameSession {
  id: string;
  character: Character;
  setting: string;
  story_template: StoryTemplate;
  chat_history: ChatMessage[];
  battle_state: BattleState | null;
  world_events: Record<string, unknown>[];
  gm_internal_notes: string;
  images_cache: Record<string, string>;
  turn_count: number;
  memory_events: MemoryEvent[];
}

// ── AI GM structured output ──

export type RollType = "ABILITY_CHECK" | "SAVING_THROW" | "ATTACK_ROLL";

export interface RollRequest {
  type: RollType;
  ability: string;
  dc: number;
  reason: string;
}

export interface StateChanges {
  damage?: number;
  heal?: number;
  add_xp?: number;
  add_items: Record<string, unknown>[];
  remove_items: Record<string, unknown>[];
  start_battle?: Record<string, unknown>[] | null;
  end_battle: boolean;
  await_roll?: RollRequest | null;
  quest_update?: Record<string, unknown> | null;
  long_rest: boolean;
  short_rest: boolean;
  set_condition?: string;
  clear_condition?: string;
  cast_spell?: Record<string, unknown> | null;
  use_ki?: number;
  exhaustion_change?: number;
  concentration_check?: Record<string, unknown> | null;
}

export interface GMResponse {
  narrative: string;
  state_changes: StateChanges;
  image_prompt?: string;
  image_key?: string;
  internal_gm_notes: string;
  suggested_actions: string[];
}

// ── API request/response shapes ──

export interface CreateSessionRequest {
  character: Character;
  setting: string;
  story_template: StoryTemplate;
}

export interface PlayerActionRequest {
  action: string;
  session_id: string;
}

export interface RollResultRequest {
  roll: number;
  session_id: string;
}

export type RestType = "short" | "long";

export interface RestRequest {
  type: RestType;
  hit_dice_spent?: number;
}

export interface SaveSlotRequest {
  slot: number;
}

export interface LoadSlotRequest {
  slot: number;
}

export interface SessionResponse {
  session: GameSession;
  last_gm_response: GMResponse | null;
}

export interface ActionResponse {
  session: GameSession;
  gm_response: GMResponse;
}

// ── WebSocket protocol ──

export type WsClientMessage = {
  action: string;
};

export type WsServerMessage =
  | { type: "chunk"; text: string }
  | { type: "state_changes"; data: StateChanges }
  | { type: "suggested_actions"; data: string[] }
  | { type: "done" }
  | { type: "error"; message: string }
  | { type: "pong" };

// ── Game engine constants (classes, races — match backend /api/character/...) ──

export const CLASSES = [
  "Fighter", "Wizard", "Rogue", "Cleric", "Monk", "Necromancer",
  "Barbarian", "Paladin", "Ranger", "Sorcerer", "Warlock", "Bard", "Druid",
] as const;

export const RACES = [
  "Human", "Elf", "Dwarf", "Halfling", "Half-Elf", "Tiefling",
  "Dragonborn", "Gnome", "Half-Orc", "Aasimar",
] as const;

export const BACKGROUNDS = [
  "Acolyte", "Charlatan", "Criminal", "Entertainer", "Folk Hero",
  "Guild Artisan", "Hermit", "Noble", "Outlander", "Sage", "Sailor",
  "Soldier", "Urchin",
] as const;

export const ABILITIES = [
  "strength", "dexterity", "constitution",
  "intelligence", "wisdom", "charisma",
] as const;

export const SKILLS = [
  "Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception",
  "History", "Insight", "Intimidation", "Investigation", "Medicine",
  "Nature", "Perception", "Performance", "Persuasion", "Religion",
  "Sleight of Hand", "Stealth", "Survival",
] as const;

export const CONDITION_LIST = [
  "Blinded", "Charmed", "Deafened", "Exhaustion", "Frightened",
  "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified",
  "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious",
] as const;

export const STORY_TEMPLATES: { value: StoryTemplate; label: string; description: string }[] = [
  { value: "three_act", label: "Three-Act Epic", description: "Classic hero's journey with rising stakes" },
  { value: "hex_crawl", label: "Hex Crawl", description: "Open-world exploration, uncover the map" },
  { value: "dungeon_delve", label: "Dungeon Delve", description: "Descend into a hostile dungeon full of traps and monsters" },
  { value: "political_intrigue", label: "Political Intrigue", description: "Navigate court politics, factions, and betrayal" },
];
