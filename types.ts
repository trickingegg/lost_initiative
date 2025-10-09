export enum Ability {
    Strength = 'Strength',
    Dexterity = 'Dexterity',
    Constitution = 'Constitution',
    Intelligence = 'Intelligence',
    Wisdom = 'Wisdom',
    Charisma = 'Charisma',
}

export enum Class {
    Fighter = 'Fighter',
    Wizard = 'Wizard',
    Rogue = 'Rogue',
    Cleric = 'Cleric',
    Monk = 'Monk',
    Necromancer = 'Necromancer',
    Custom = 'Custom',
}

export enum Race {
    Human = 'Human',
    Elf = 'Elf',
    Dwarf = 'Dwarf',
    Halfling = 'Halfling',
}

export enum Background {
    Acolyte = 'Acolyte',
    Charlatan = 'Charlatan',
    Criminal = 'Criminal',
    Entertainer = 'Entertainer',
    FolkHero = 'Folk Hero',
    GuildArtisan = 'Guild Artisan',
    Hermit = 'Hermit',
    Noble = 'Noble',
    Outlander = 'Outlander',
    Sage = 'Sage',
    Sailor = 'Sailor',
    Soldier = 'Soldier',
    Urchin = 'Urchin',
}

export enum Skill {
    Acrobatics = 'Acrobatics',
    AnimalHandling = 'Animal Handling',
    Arcana = 'Arcana',
    Athletics = 'Athletics',
    Deception = 'Deception',
    History = 'History',
    Insight = 'Insight',
    Intimidation = 'Intimidation',
    Investigation = 'Investigation',
    Medicine = 'Medicine',
    Nature = 'Nature',
    Perception = 'Perception',
    Performance = 'Performance',
    Persuasion = 'Persuasion',
    Religion = 'Religion',
    SleightOfHand = 'Sleight of Hand',
    Stealth = 'Stealth',
    Survival = 'Survival',
}


export interface Item {
    name: string;
    quantity: number;
}

export interface Quest {
    title: string;
    description: string;
    isActive: boolean;
}

export interface Spell {
    name:string;
    description: string;
}

export interface SpellSlotInfo {
    current: number;
    max: number;
}

export interface Feature {
    name: string;
    description: string;
}

export interface Archetype {
    name: string;
    description: string;
    features: Record<number, Feature[]>; // level -> features gained
}


export interface Character {
    name: string;
    race: Race;
    class: Class;
    classDescription?: string;
    background: Background;
    level: number;
    xp: number;
    hp: {
        current: number;
        max: number;
    };
    ac: number;
    speed: number;
    abilities: Record<Ability, number>;
    skills: Skill[];
    inventory: Item[];
    spells: Spell[];
    quests: Quest[];
    spellSlots: Record<number, SpellSlotInfo>; // Key is spell level
    archetype?: Archetype;
    features: Feature[];
    ki?: {
        current: number;
        max: number;
    };
}

export interface ChatMessage {
    sender: 'player' | 'gm' | 'system';
    text: string;
}

export enum Screen {
    Menu = 'MENU',
    Settings = 'SETTINGS',
    Setup = 'SETUP',
    Creation = 'CREATION',
    Game = 'GAME',
}

export enum RollType {
    ABILITY_CHECK = 'ABILITY_CHECK',
    SAVING_THROW = 'SAVING_THROW',
    INITIATIVE = 'INITIATIVE',
}

export interface AwaitingRollState {
    type: RollType;
    ability: Ability;
    dc: number;
}

export interface Enemy {
    id: string;
    name: string;
    hp: {
        current: number;
        max: number;
    };
    ac: number;
    initiative: number;
    initiativeBonus: number;
}

export interface Ally {
    id: string;
    name: string;
    hp: {
        current: number;
        max: number;
    };
    ac: number;
}

export interface BattleState {
    enemies: Enemy[];
    allies: Ally[];
    turnOrder: string[]; // array of IDs ('player' or enemy/ally ids)
    currentTurnIndex: number;
}

export interface LevelUpSkillChoice {
    from: Skill[];
    count: number;
}

export interface LevelUpArchetypeChoice {
    from: Archetype[];
}

export interface LevelUpSpellChoice {
    count: number;
}

export interface AwaitingLevelUpChoices {
    level: number;
    skillChoice?: LevelUpSkillChoice;
    archetypeChoice?: LevelUpArchetypeChoice;
    spellChoice?: LevelUpSpellChoice;
}

export interface GameState {
    character: Character | null;
    chatHistory: ChatMessage[];
    screen: Screen;
    isLoading: boolean;
    awaitingRoll: AwaitingRollState | null;
    awaitingLevelUpChoices: AwaitingLevelUpChoices | null;
    gameId: number;
    setting: string | null;
    temperature: number;
    battle: BattleState | null;
    // Image generation state
    imagesCache: Record<string, string>; // key -> base64 data URL
    imagePrompts: Record<string, string>; // key -> prompt
    currentImageKey: string | null; // The key of the image to display or offer to generate
    isGeneratingImage: boolean;
}