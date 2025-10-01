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
    name: string;
    description: string;
}

export interface Character {
    name: string;
    race: Race;
    class: Class;
    background: Background;
    level: number;
    xp: number;
    hp: {
        current: number;
        max: number;
    };
    ac: number;
    speed: number;
    gold: number;
    abilities: Record<Ability, number>;
    skills: Skill[];
    inventory: Item[];
    spells: Spell[];
    quests: Quest[];
}

export interface ChatMessage {
    sender: 'player' | 'gm';
    text: string;
}

export enum Screen {
    Creation = 'CREATION',
    Game = 'GAME',
}

export enum RollType {
    ABILITY_CHECK = 'ABILITY_CHECK',
    SAVING_THROW = 'SAVING_THROW',
}

export interface AwaitingRollState {
    type: RollType;
    ability: Ability;
    dc: number;
}

export interface GameState {
    character: Character | null;
    chatHistory: ChatMessage[];
    screen: Screen;
    isLoading: boolean;
    awaitingRoll: AwaitingRollState | null;
}