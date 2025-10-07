import { Ability, Character, Class, Race, Background, Item, Skill, Spell } from './types';

export const STANDARD_ABILITY_SCORES = [15, 14, 13, 12, 10, 8];

export const INITIAL_CHARACTER: Omit<Character, 'name' | 'race' | 'class'> = {
    level: 1,
    xp: 0,
    background: Background.Acolyte,
    hp: { current: 10, max: 10 },
    ac: 10,
    speed: 30,
    gold: 10,
    abilities: {
        [Ability.Strength]: 10,
        [Ability.Dexterity]: 10,
        [Ability.Constitution]: 10,
        [Ability.Intelligence]: 10,
        [Ability.Wisdom]: 10,
        [Ability.Charisma]: 10,
    },
    skills: [],
    inventory: [],
    spells: [],
    quests: [],
};

type EquipmentChoice = {
    [key: string]: (string | Item)[];
};

const CUSTOM_CLASS_EQUIPMENT: EquipmentChoice[] = [
    { "Armor": ["Leather Armor", "Scale Mail", "Chain Mail"] },
    { "Melee Weapon": ["Mace", "Longsword", "Two Daggers"] },
    { "Ranged Weapon": ["Light Crossbow", "Shortbow"] },
    { "Pack": ["Explorer's Pack", "Dungeoneer's Pack", "Scholar's Pack"] }
];

export const WIZARD_SPELLS: Record<'cantrips' | 'level1', Spell[]> = {
    cantrips: [
        { name: 'Acid Splash', description: 'Hurl a bubble of acid.' },
        { name: 'Chill Touch', description: 'A spectral hand attacks one creature.' },
        { name: 'Fire Bolt', description: 'Hurl a mote of fire.' },
        { name: 'Light', description: 'Make an object glow with light.' },
        { name: 'Mage Hand', description: 'Create a spectral, floating hand.' },
        { name: 'Prestidigitation', description: 'Perform a minor magical trick.' },
        { name: 'Ray of Frost', description: 'A beam of cold slows a creature.' },
        { name: 'Shocking Grasp', description: 'A touch delivers a shocking jolt.' },
    ],
    level1: [
        { name: 'Burning Hands', description: 'A cone of fire erupts from your hands.' },
        { name: 'Charm Person', description: 'You magically charm a humanoid.' },
        { name: 'Detect Magic', description: 'Sense the presence of magic.' },
        { name: 'Feather Fall', description: 'Slow the falling speed of creatures.' },
        { name: 'Mage Armor', description: 'Touch a creature to grant magical armor.' },
        { name: 'Magic Missile', description: 'Create darts of magical force.' },
        { name: 'Shield', description: 'An invisible barrier protects you.' },
        { name: 'Silent Image', description: 'Create a minor visual illusion.' },
        { name: 'Sleep', description: 'Magically put creatures to sleep.' },
        { name: 'Thunderwave', description: 'A wave of thunderous force pushes creatures.' },
    ]
};

export const NECROMANCER_SPELLS: Record<'cantrips' | 'level1', Spell[]> = {
    cantrips: [
        { name: 'Chill Touch', description: 'A spectral hand attacks one creature, preventing healing.' },
        { name: 'Toll the Dead', description: 'A dolorous bell sound drains life from a creature.' },
        { name: 'Mage Hand', description: 'Create a spectral, floating hand.' },
        { name: 'Prestidigitation', description: 'Perform a minor magical trick.' },
    ],
    level1: [
        { name: 'False Life', description: 'You gain temporary hit points.' },
        { name: 'Ray of Sickness', description: 'A ray of green energy sickens a creature.' },
        { name: 'Cause Fear', description: 'Project an image of a creature\'s worst fears.' },
        { name: 'Inflict Wounds', description: 'A touch that channels necrotic energy.' },
    ]
};

export const CLASSES_DATA: Record<Class, { 
    hitDie: number, 
    description: string,
    equipmentChoices: EquipmentChoice[],
    abilityPriority: Ability[],
    skillChoices: { from: Skill[], count: number },
    spellChoices?: { cantrips: number, level1: number }
}> = {
    [Class.Fighter]: { 
        hitDie: 10, 
        description: "A master of martial combat, skilled with a variety of weapons and armor.",
        equipmentChoices: [
            { "Armor": ["Chain Mail", "Leather Armor"] },
            { "Weapon & Shield": ["Longsword & Shield", "Two Martial Weapons"] },
            { "Ranged": ["Light Crossbow", "Two Handaxes"] },
            { "Pack": ["Dungeoneer's Pack", "Explorer's Pack"] }
        ],
        abilityPriority: [Ability.Strength, Ability.Constitution, Ability.Dexterity, Ability.Wisdom, Ability.Charisma, Ability.Intelligence],
        skillChoices: { from: [Skill.Acrobatics, Skill.AnimalHandling, Skill.Athletics, Skill.History, Skill.Insight, Skill.Intimidation, Skill.Perception, Skill.Survival], count: 2 }
    },
    [Class.Wizard]: { 
        hitDie: 6, 
        description: "A scholarly magic-user capable of manipulating the structures of reality.",
        equipmentChoices: [
            { "Weapon": ["Quarterstaff", "Dagger"] },
            { "Arcane Focus": ["Component Pouch", "Arcane Focus"] },
            { "Pack": ["Scholar's Pack", "Explorer's Pack"] },
            { "Misc": ["Spellbook"] }
        ],
        abilityPriority: [Ability.Intelligence, Ability.Constitution, Ability.Dexterity, Ability.Wisdom, Ability.Charisma, Ability.Strength],
        skillChoices: { from: [Skill.Arcana, Skill.History, Skill.Insight, Skill.Investigation, Skill.Medicine, Skill.Religion], count: 2 },
        spellChoices: { cantrips: 3, level1: 6 }
    },
    [Class.Rogue]: { 
        hitDie: 8, 
        description: "A scoundrel who uses stealth and trickery to overcome obstacles and enemies.",
        equipmentChoices: [
            { "Weapon": ["Rapier", "Shortsword"] },
            { "Ranged": ["Shortbow & Quiver of 20 Arrows", "Shortsword"] },
            { "Pack": ["Burglar's Pack", "Dungeoneer's Pack", "Explorer's Pack"] },
            { "Misc": ["Leather Armor", "Two Daggers", "Thieves' Tools"] }
        ],
        abilityPriority: [Ability.Dexterity, Ability.Charisma, Ability.Intelligence, Ability.Wisdom, Ability.Constitution, Ability.Strength],
        skillChoices: { from: [Skill.Acrobatics, Skill.Athletics, Skill.Deception, Skill.Insight, Skill.Intimidation, Skill.Investigation, Skill.Perception, Skill.Performance, Skill.Persuasion, Skill.SleightOfHand, Skill.Stealth], count: 4 }
    },
    [Class.Cleric]: { 
        hitDie: 8, 
        description: "A priestly champion who wields divine magic in service of a higher power.",
        equipmentChoices: [
            { "Weapon": ["Mace", "Warhammer"] },
            { "Armor": ["Scale Mail", "Leather Armor", "Chain Mail"] },
            { "Ranged & Shield": ["Light Crossbow & 20 Bolts", "Any Simple Weapon", "Shield"], },
            { "Pack": ["Priest's Pack", "Explorer's Pack"] },
            { "Misc": ["Holy Symbol"] }
        ],
        abilityPriority: [Ability.Wisdom, Ability.Constitution, Ability.Strength, Ability.Charisma, Ability.Dexterity, Ability.Intelligence],
        skillChoices: { from: [Skill.History, Skill.Insight, Skill.Medicine, Skill.Persuasion, Skill.Religion], count: 2 }
    },
    [Class.Monk]: {
        hitDie: 8,
        description: "A master of martial arts, harnessing the power of the body in pursuit of physical and spiritual perfection. At higher levels, they can project their ki as astral arms.",
        equipmentChoices: [
            { "Weapon": ["Shortsword", "Simple Weapon"] },
            { "Pack": ["Dungeoneer's Pack", "Explorer's Pack"] },
            { "Misc": ["10 Darts"] }
        ],
        abilityPriority: [Ability.Dexterity, Ability.Wisdom, Ability.Constitution, Ability.Intelligence, Ability.Charisma, Ability.Strength],
        skillChoices: { from: [Skill.Acrobatics, Skill.Athletics, Skill.History, Skill.Insight, Skill.Religion, Skill.Stealth], count: 2 }
    },
    [Class.Necromancer]: {
        hitDie: 6,
        description: "A practitioner of forbidden arts, a Necromancer commands the forces of life and death, raising undead minions to serve their will.",
        equipmentChoices: [
            { "Weapon": ["Dagger", "Light Crossbow"] },
            { "Arcane Focus": ["Component Pouch", "Arcane Focus"] },
            { "Pack": ["Scholar's Pack", "Explorer's Pack"] },
            { "Misc": ["Spellbook"] }
        ],
        abilityPriority: [Ability.Intelligence, Ability.Constitution, Ability.Wisdom, Ability.Dexterity, Ability.Charisma, Ability.Strength],
        skillChoices: { from: [Skill.Arcana, Skill.History, Skill.Deception, Skill.Investigation, Skill.Medicine, Skill.Religion], count: 2 },
        spellChoices: { cantrips: 2, level1: 4 }
    },
    [Class.Custom]: {
        hitDie: 8,
        description: "Create your own unique class by describing it and choosing your primary abilities.",
        equipmentChoices: CUSTOM_CLASS_EQUIPMENT,
        abilityPriority: [], // User will choose
        skillChoices: { from: Object.values(Skill), count: 3 },
    }
};

export const RACES_DATA: Record<Race, { description: string, abilityBonuses?: Partial<Record<Ability, number>> }> = {
    [Race.Human]: { description: "Ambitious, versatile, and the most common of races.", abilityBonuses: { [Ability.Strength]: 1, [Ability.Dexterity]: 1, [Ability.Constitution]: 1, [Ability.Intelligence]: 1, [Ability.Wisdom]: 1, [Ability.Charisma]: 1 } },
    [Race.Elf]: { description: "A magical people of otherworldly grace, living in the world but not entirely part of it.", abilityBonuses: { [Ability.Dexterity]: 2 } },
    [Race.Dwarf]: { description: "Bold and hardy, known as skilled warriors, miners, and workers of stone and metal.", abilityBonuses: { [Ability.Constitution]: 2 } },
    [Race.Halfling]: { description: "A practical and resilient folk who prefer the comforts of home but can be surprisingly brave.", abilityBonuses: { [Ability.Dexterity]: 2 } },
};

export const BACKGROUNDS_DATA: Record<Background, { description: string, gold: number, equipment: (string | Item)[], skillProficiencies: Skill[] }> = {
    [Background.Acolyte]: { description: "You have spent your life in the service of a temple.", gold: 15, equipment: ["A holy symbol", "A prayer book", "5 sticks of incense", "Vestments", "Common clothes"], skillProficiencies: [Skill.Insight, Skill.Religion] },
    [Background.Charlatan]: { description: "You're a master of deception and disguise.", gold: 15, equipment: ["Fine clothes", "Disguise kit", "Tools of the con of your choice"], skillProficiencies: [Skill.Deception, Skill.SleightOfHand] },
    [Background.Criminal]: { description: "You have a history of breaking the law.", gold: 15, equipment: ["A crowbar", "Dark common clothes with a hood"], skillProficiencies: [Skill.Deception, Skill.Stealth] },
    [Background.Entertainer]: { description: "You live to perform and captivate audiences.", gold: 15, equipment: ["A musical instrument", "The favor of an admirer", "A costume"], skillProficiencies: [Skill.Acrobatics, Skill.Performance] },
    [Background.FolkHero]: { description: "You come from a humble background but are destined for greatness.", gold: 10, equipment: ["A set of artisan's tools", "A shovel", "An iron pot", "Common clothes"], skillProficiencies: [Skill.AnimalHandling, Skill.Survival] },
    [Background.GuildArtisan]: { description: "You're a member of an artisan's guild, skilled in a particular craft.", gold: 15, equipment: ["A set of artisan's tools", "A letter of introduction from your guild", "Traveler's clothes"], skillProficiencies: [Skill.Insight, Skill.Persuasion] },
    [Background.Hermit]: { description: "You lived in seclusion for a formative part of your life.", gold: 5, equipment: ["A scroll case stuffed with notes", "A winter blanket", "Common clothes", "Herbalism kit"], skillProficiencies: [Skill.Medicine, Skill.Religion] },
    [Background.Noble]: { description: "You come from a family of wealth and privilege.", gold: 25, equipment: ["A set of fine clothes", "A signet ring", "A scroll of pedigree"], skillProficiencies: [Skill.History, Skill.Persuasion] },
    [Background.Outlander]: { description: "You grew up in the wilds, far from civilization.", gold: 10, equipment: ["A staff", "A hunting trap", "A trophy from an animal you killed", "Traveler's clothes"], skillProficiencies: [Skill.Athletics, Skill.Survival] },
    [Background.Sage]: { description: "You are a scholar, having spent years in academic pursuit.", gold: 10, equipment: ["A bottle of black ink", "A quill", "A small knife", "A letter from a dead colleague", "Common clothes"], skillProficiencies: [Skill.Arcana, Skill.History] },
    [Background.Sailor]: { description: "You've spent your life on the high seas.", gold: 10, equipment: ["A belaying pin (club)", "50 feet of silk rope", "A lucky charm", "Common clothes"], skillProficiencies: [Skill.Athletics, Skill.Perception] },
    [Background.Soldier]: { description: "You were a trained warrior in an army.", gold: 10, equipment: ["An insignia of rank", "A trophy taken from a fallen enemy", "A set of bone dice or deck of cards", "Common clothes"], skillProficiencies: [Skill.Athletics, Skill.Intimidation] },
    [Background.Urchin]: { description: "You grew up on the streets alone, orphaned, and poor.", gold: 10, equipment: ["A small knife", "A map of the city you grew up in", "A pet mouse", "A token to remember your parents by", "Common clothes"], skillProficiencies: [Skill.SleightOfHand, Skill.Stealth] },
};


// XP needed to reach the next level. Index is current level.
// e.g., XP_THRESHOLDS[1] is XP needed to reach level 2.
export const XP_THRESHOLDS = [
    0,      // Level 1
    300,    // Level 2
    900,    // Level 3
    2700,   // Level 4
    6500,   // Level 5
    14000,  // Level 6
    23000,  // Level 7
    34000,  // Level 8
    48000,  // Level 9
    64000,  // Level 10
];