export type StoryTemplate =
    | 'three_act'
    | 'hex_crawl'
    | 'dungeon_delve'
    | 'political_intrigue';

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

export interface ChatMessage {
    role: 'player' | 'gm' | 'system';
    content: string;
}

export interface Item {
    name: string;
    quantity: number;
    description?: string | null;
}

export interface Quest {
    title: string;
    description: string;
    status: 'active' | 'completed' | 'failed';
}

export interface Feature {
    name: string;
    description: string;
}

export interface DeathSaves {
    successes: number;
    failures: number;
}

export interface Character {
    id: string;
    name: string;
    race: string;
    char_class: string;
    subclass: string | null;
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
    spell_slots: Record<string, SpellSlot>;
    ki_current: number | null;
    ki_max: number | null;
    conditions: string[];
    death_saves: DeathSaves;
    quests: Quest[];
    hit_dice_current: number | null;
    hit_dice_max: number | null;
}

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

export interface PendingLevelUp {
    new_level: number;
    hp_increase: number;
    proficiency_bonus: number;
    new_features: string[];
}

export interface GameSession {
    id: string;
    character: Character;
    setting: string;
    story_template: StoryTemplate;
    chat_history: ChatMessage[];
    battle_state: BattleState | null;
    world_events: unknown[];
    gm_internal_notes: string;
    images_cache: Record<string, string>;
    turn_count: number;
    memory_events: unknown[];
    pending_level_up: PendingLevelUp | null;
}

export interface RollRequest {
    type: 'ABILITY_CHECK' | 'SAVING_THROW' | 'ATTACK_ROLL' | 'DEATH_SAVE';
    ability: string;
    dc: number;
    reason: string;
}

export interface StateChanges {
    damage: number | null;
    heal: number | null;
    add_xp: number | null;
    add_items: unknown[];
    remove_items: unknown[];
    start_battle: unknown[] | null;
    end_battle: boolean;
    await_roll: RollRequest | null;
    quest_update: unknown | null;
    long_rest: boolean;
    short_rest: boolean;
    set_condition: string | null;
    clear_condition: string | null;
    cast_spell: unknown | null;
    use_ki: number | null;
    combatant_damage: unknown[];
}

export interface GMResponse {
    narrative: string;
    state_changes: StateChanges;
    image_prompt: string | null;
    image_key: string | null;
    internal_gm_notes: string;
    suggested_actions: string[];
}

export interface SessionResponse {
    session: GameSession;
    last_gm_response: GMResponse | null;
}

export interface ActionResponse {
    session: GameSession;
    gm_response: GMResponse;
}

export interface SaveSlotInfo {
    slot: number;
    character_name: string;
    turn_count: number;
    saved_at: string;
}

export const STORY_TEMPLATES: { id: StoryTemplate; label: string; description: string }[] = [
    { id: 'dungeon_delve', label: 'Dungeon Delve', description: 'A dungeon with a clear objective, traps, and a boss.' },
    { id: 'three_act', label: 'Three-Act Story', description: 'Setup, confrontation, and a climactic resolution.' },
    { id: 'hex_crawl', label: 'Hex Crawl', description: 'Wilderness exploration, landmarks, and the unknown.' },
    { id: 'political_intrigue', label: 'Political Intrigue', description: 'Factions, secrets, and social consequences.' },
];
