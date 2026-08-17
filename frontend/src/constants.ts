import { Ability, Character, Class, Race, Background, Item, Skill, Spell, Archetype } from './types';

export const STANDARD_ABILITY_SCORES = [15, 14, 13, 12, 10, 8];

export const INITIAL_CHARACTER: Omit<Character, 'name' | 'race' | 'class'> = {
    level: 1,
    xp: 0,
    background: Background.Acolyte,
    hp: { current: 10, max: 10 },
    ac: 10,
    speed: 30,
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
    spellSlots: {},
    features: [],
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

export const WIZARD_SPELLS: Record<'cantrips' | 'level1' | 'level2' | 'level3', Spell[]> = {
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
        { name: 'Burning Hands', description: 'As you hold your hands with thumbs touching and fingers spread, a thin sheet of flames shoots forth from your outstretched fingertips. Each creature in a 15-foot cone must make a Dexterity saving throw.' },
        { name: 'Charm Person', description: 'You attempt to charm a humanoid you can see within range. It must make a Wisdom saving throw, and does so with advantage if you or your companions are fighting it.' },
        { name: 'Detect Magic', description: 'For the duration, you sense the presence of magic within 30 feet of you. You can use your action to see a faint aura around any visible creature or object in the area that bears magic, and you learn its school of magic, if any.' },
        { name: 'Feather Fall', description: 'Choose up to five falling creatures within range. A falling creature\'s rate of descent slows to 60 feet per round until the spell ends.' },
        { name: 'Fog Cloud', description: 'You create a 20-foot-radius sphere of fog centered on a point within range.' },
        { name: 'Grease', description: 'Slick grease covers the ground in a 10-foot square, making it difficult terrain.' },
        { name: 'Identify', description: 'You choose one object that you must touch throughout the casting of the spell. You learn its properties.' },
        { name: 'Mage Armor', description: 'You touch a willing creature who isn\'t wearing armor, and a protective magical force surrounds it until the spell ends. The target\'s base AC becomes 13 + its Dexterity modifier.' },
        { name: 'Magic Missile', description: 'You create three glowing darts of magical force. Each dart hits a creature of your choice that you can see within range. A dart deals 1d4 + 1 force damage to its target. The darts all strike simultaneously.' },
        { name: 'Shield', description: 'An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack, and you take no damage from magic missile.' },
        { name: 'Silent Image', description: 'You create the image of an object, a creature, or some other visible phenomenon that is no larger than a 15-foot cube. The image is purely visual; it isn\'t accompanied by sound, smell, or other sensory effects.' },
        { name: 'Sleep', description: 'This spell sends creatures into a magical slumber. Roll 5d8; the total is how many hit points of creatures this spell can affect.' },
        { name: 'Tasha\'s Hideous Laughter', description: 'A creature of your choice perceives everything as hilariously funny and falls into fits of laughter if this spell affects it.' },
        { name: 'Thunderwave', description: 'A wave of thunderous force sweeps out from you. Each creature in a 15-foot cube originating from you must make a Constitution saving throw. On a failed save, a creature takes 2d8 thunder damage and is pushed 10 feet away from you.' },
    ],
    level2: [
        { name: 'Acid Arrow', description: 'A shimmering arrow of green acid streaks toward a target, dealing acid damage on hit and again on the next turn.' },
        { name: 'Blur', description: 'Your body becomes blurred, shifting and wavering. Attackers have disadvantage on attack rolls against you.' },
        { name: 'Darkvision', description: 'You touch a willing creature to grant it the ability to see in the dark.' },
        { name: 'Hold Person', description: 'Choose a humanoid that you can see within range. The target must succeed on a Wisdom saving throw or be paralyzed for the duration.' },
        { name: 'Invisibility', description: 'A creature you touch becomes invisible until the spell ends.' },
        { name: 'Mirror Image', description: 'Three illusory duplicates of yourself appear in your space. Until the spell ends, the duplicates move with you and mimic your actions.' },
        { name: 'Misty Step', description: 'Briefly surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space that you can see.' },
        { name: 'Scorching Ray', description: 'You create three rays of fire and hurl them at targets within range.' },
        { name: 'Suggestion', description: 'You influence a creature you can see, shaping its actions by suggesting a course of activity.' },
        { name: 'Web', description: 'You conjure a mass of thick, sticky webbing at a point of your choice within range.' },
    ],
    level3: [
        { name: 'Counterspell', description: 'You attempt to interrupt a creature in the process of casting a spell.' },
        { name: 'Dispel Magic', description: 'Choose one creature, object, or magical effect within range. Any spell of 3rd level or lower on the target ends.' },
        { name: 'Fireball', description: 'A bright streak flashes from your pointing finger to a point you choose and then blossoms with a low roar into an explosion of flame.' },
        { name: 'Fly', description: 'You touch a willing creature. The target gains a flying speed of 60 feet for the duration.' },
        { name: 'Haste', description: 'Choose a willing creature that isn\'t wearing heavy armor. The target\'s speed is doubled, it gains a +2 bonus to AC, it has advantage on Dexterity saving throws, and it gains an additional action on each of its turns.' },
        { name: 'Hypnotic Pattern', description: 'You create a twisting pattern of colors that charms creatures within a 30-foot cube.' },
        { name: 'Lightning Bolt', description: 'A stroke of lightning forming a line 100 feet long and 5 feet wide blasts out from you.' },
        { name: 'Slow', description: 'You alter time around up to six creatures of your choice in a 40-foot cube, causing them to be slowed.' },
        { name: 'Stinking Cloud', description: 'You create a 20-foot-radius sphere of yellow, nauseating gas. The area is heavily obscured and creatures in it must make a Constitution save or spend its action retching and reeling.' },
    ]
};

export const NECROMANCER_SPELLS: Record<'cantrips' | 'level1' | 'level2' | 'level3', Spell[]> = {
    cantrips: [
        { name: 'Chill Touch', description: 'A spectral hand attacks one creature, preventing healing.' },
        { name: 'Mage Hand', description: 'Create a spectral, floating hand.' },
        { name: 'Prestidigitation', description: 'Perform a minor magical trick.' },
        { name: 'Sapping Sting', description: 'You sap the vitality of one creature. The target must succeed on a Constitution saving throw or take necrotic damage and fall prone.' },
        { name: 'Toll the Dead', description: 'A dolorous bell sound drains life from a creature.' },
    ],
    level1: [
        { name: 'Bane', description: 'Up to three creatures must make Charisma saving throws. On a failure, when they make an attack roll or saving throw, they must subtract a d4 from the result.' },
        { name: 'Cause Fear', description: 'You awaken the sense of mortality in one creature. The target must succeed on a Wisdom saving throw or become frightened of you.' },
        { name: 'Command', description: 'You speak a one-word command to a creature. It must succeed on a Wisdom saving throw or follow the command on its next turn.' },
        { name: 'False Life', description: 'Bolstering yourself with a necromantic facsimile of life, you gain 1d4 + 4 temporary hit points for the duration.' },
        { name: 'Inflict Wounds', description: 'Make a melee spell attack against a creature you can reach. On a hit, the target takes 3d10 necrotic damage.' },
        { name: 'Ray of Sickness', description: 'A ray of sickening greenish energy lashes out toward a creature. Make a ranged spell attack. On a hit, the target takes 2d8 poison damage and may be poisoned.' },
    ],
    level2: [
        { name: 'Blindness/Deafness', description: 'You can blind or deafen a foe. Choose one creature that you can see within range to make a Constitution saving throw.' },
        { name: 'Crown of Madness', description: 'One humanoid must succeed on a Wisdom save or become charmed. The charmed target must use its action to make a melee attack against a creature other than itself that you mentally choose.' },
        { name: 'Gentle Repose', description: 'You touch a corpse or other remains. For the duration, the target is protected from decay and can\'t become undead.' },
        { name: 'Hold Person', description: 'Choose a humanoid that you can see within range. The target must succeed on a Wisdom saving throw or be paralyzed for the duration.' },
        { name: 'Ray of Enfeeblement', description: 'A black beam of enervating energy springs from your finger toward a creature. The target deals only half damage with weapon attacks that use Strength.' },
    ],
    level3: [
        { name: 'Animate Dead', description: 'This spell creates an undead servant. Choose a pile of bones or a corpse of a Medium or Small humanoid within range.' },
        { name: 'Bestow Curse', description: 'You touch a creature, and that creature must succeed on a Wisdom saving throw or become cursed for the duration of the spell.' },
        { name: 'Fear', description: 'You project a phantasmal image of a creature\'s worst fears. Each creature in a 30-foot cone must succeed on a Wisdom save or drop whatever it is holding and become frightened.' },
        { name: 'Speak with Dead', description: 'You grant the semblance of life and intelligence to a corpse of your choice, allowing it to answer questions you pose.' },
        { name: 'Vampiric Touch', description: 'The touch of your shadow-wreathed hand can drain life force from others to heal your own wounds. On a hit, the target takes 3d6 necrotic damage, and you regain hit points equal to half the amount of necrotic damage dealt.' },
    ]
};

// For Wizard, Cleric, Necromancer (which we treat as a wizard)
// Format: { level: { spell_level_1: slots, spell_level_2: slots, ... } }
export const FULL_CASTER_SPELL_SLOTS: Record<number, Record<number, number>> = {
    1: { 1: 2 },
    2: { 1: 3 },
    3: { 1: 4, 2: 2 },
    4: { 1: 4, 2: 3 },
    5: { 1: 4, 2: 3, 3: 2 },
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
        description: "A master of martial arts, harnessing the power of the body in pursuit of physical and spiritual perfection.",
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

export const BACKGROUNDS_DATA: Record<Background, { description: string, equipment: (string | Item)[], skillProficiencies: Skill[] }> = {
    [Background.Acolyte]: { description: "You have spent your life in the service of a temple.", equipment: [{ name: "Gold Pieces", quantity: 15 }, "A holy symbol", "A prayer book", "5 sticks of incense", "Vestments", "Common clothes"], skillProficiencies: [Skill.Insight, Skill.Religion] },
    [Background.Charlatan]: { description: "You're a master of deception and disguise.", equipment: [{ name: "Gold Pieces", quantity: 15 }, "Fine clothes", "Disguise kit", "Tools of the con of your choice"], skillProficiencies: [Skill.Deception, Skill.SleightOfHand] },
    [Background.Criminal]: { description: "You have a history of breaking the law.", equipment: [{ name: "Gold Pieces", quantity: 15 }, "A crowbar", "Dark common clothes with a hood"], skillProficiencies: [Skill.Deception, Skill.Stealth] },
    [Background.Entertainer]: { description: "You live to perform and captivate audiences.", equipment: [{ name: "Gold Pieces", quantity: 15 }, "A musical instrument", "The favor of an admirer", "A costume"], skillProficiencies: [Skill.Acrobatics, Skill.Performance] },
    [Background.FolkHero]: { description: "You come from a humble background but are destined for greatness.", equipment: [{ name: "Gold Pieces", quantity: 10 }, "A set of artisan's tools", "A shovel", "An iron pot", "Common clothes"], skillProficiencies: [Skill.AnimalHandling, Skill.Survival] },
    [Background.GuildArtisan]: { description: "You're a member of an artisan's guild, skilled in a particular craft.", equipment: [{ name: "Gold Pieces", quantity: 15 }, "A set of artisan's tools", "A letter of introduction from your guild", "Traveler's clothes"], skillProficiencies: [Skill.Insight, Skill.Persuasion] },
    [Background.Hermit]: { description: "You lived in seclusion for a formative part of your life.", equipment: [{ name: "Gold Pieces", quantity: 5 }, "A scroll case stuffed with notes", "A winter blanket", "Common clothes", "Herbalism kit"], skillProficiencies: [Skill.Medicine, Skill.Religion] },
    [Background.Noble]: { description: "You come from a family of wealth and privilege.", equipment: [{ name: "Gold Pieces", quantity: 25 }, "A set of fine clothes", "A signet ring", "A scroll of pedigree"], skillProficiencies: [Skill.History, Skill.Persuasion] },
    [Background.Outlander]: { description: "You grew up in the wilds, far from civilization.", equipment: [{ name: "Gold Pieces", quantity: 10 }, "A staff", "A hunting trap", "A trophy from an animal you killed", "Traveler's clothes"], skillProficiencies: [Skill.Athletics, Skill.Survival] },
    [Background.Sage]: { description: "You are a scholar, having spent years in academic pursuit.", equipment: [{ name: "Gold Pieces", quantity: 10 }, "A bottle of black ink", "A quill", "A small knife", "A letter from a dead colleague", "Common clothes"], skillProficiencies: [Skill.Arcana, Skill.History] },
    [Background.Sailor]: { description: "You've spent your life on the high seas.", equipment: [{ name: "Gold Pieces", quantity: 10 }, "A belaying pin (club)", "50 feet of silk rope", "A lucky charm", "Common clothes"], skillProficiencies: [Skill.Athletics, Skill.Perception] },
    [Background.Soldier]: { description: "You were a trained warrior in an army.", equipment: [{ name: "Gold Pieces", quantity: 10 }, "An insignia of rank", "A trophy taken from a fallen enemy", "A set of bone dice or deck of cards", "Common clothes"], skillProficiencies: [Skill.Athletics, Skill.Intimidation] },
    [Background.Urchin]: { description: "You grew up on the streets alone, orphaned, and poor.", equipment: [{ name: "Gold Pieces", quantity: 10 }, "A small knife", "A map of the city you grew up in", "A pet mouse", "A token to remember your parents by", "Common clothes"], skillProficiencies: [Skill.SleightOfHand, Skill.Stealth] },
};

export const ARCHETYPES_DATA: Partial<Record<Class, Archetype[]>> = {
    [Class.Fighter]: [
        {
            name: 'Champion',
            description: 'The archetypal Champion focuses on raw physical power and athletic prowess. They are deadly simple and simply deadly.',
            features: {
                3: [{ name: 'Improved Critical', description: 'Your weapon attacks score a critical hit on a roll of 19 or 20.' }],
            }
        },
        {
            name: 'Battle Master',
            description: 'Students of strategy, Battle Masters use special combat maneuvers to control the battlefield. You learn tactical maneuvers to gain an edge.',
            features: {
                3: [{ name: 'Tactical Insight', description: 'You gain proficiency in the Investigation skill and can better assess enemy weaknesses.' }],
            }
        }
    ],
    [Class.Rogue]: [
        {
            name: 'Thief',
            description: 'You hone your skills in larceny. You have a knack for disabling traps, opening locks, and using items in clever ways.',
            features: {
                3: [{ name: 'Fast Hands', description: 'You can take a bonus action on each of your turns in combat to use an item, disarm a trap, or open a lock.' }],
            }
        },
        {
            name: 'Assassin',
            description: 'You focus your training on the grim art of death. You are a master of infiltration, disguise, and dealing lethal strikes.',
            features: {
                3: [{ name: 'Assassinate', description: 'You have advantage on attack rolls against any creature that hasn\'t taken a turn in combat yet.' }],
            }
        }
    ],
    [Class.Cleric]: [
        {
            name: 'Life Domain',
            description: 'The Life domain focuses on the vibrant positive energy that sustains all life. Your healing spells are empowered.',
            features: {
                3: [{ name: 'Disciple of Life', description: 'Whenever you use a spell of 1st level or higher to restore hit points to a creature, the creature regains additional hit points.' }],
            }
        },
        {
            name: 'Light Domain',
            description: 'Gods of light promote the ideals of rebirth and renewal, truth, vigilance, and beauty, often using the power of the sun.',
            features: {
                3: [{ name: 'Warding Flare', description: 'You can interpose divine light between yourself and an attacking enemy, imposing disadvantage on the attack roll.' }],
            }
        }
    ],
    [Class.Wizard]: [
        {
            name: 'School of Evocation',
            description: 'You focus your study on magic that creates powerful elemental effects such as bitter cold, searing flame, rolling thunder, and burning acid.',
            features: {
                3: [{ name: 'Sculpt Spells', description: 'When you cast an evocation spell, you can create pockets of safety within the area of effect, protecting allies from harm.' }],
            }
        },
        {
            name: 'School of Illusion',
            description: 'You focus your studies on deception and mirages. You learn to alter perceptions and create elaborate phantasms.',
            features: {
                3: [{ name: 'Improved Minor Illusion', description: 'You learn the Minor Illusion cantrip. If you already know it, you learn a different wizard cantrip. The illusion can now include sound and images.' }],
            }
        }
    ],
    [Class.Monk]: [
        {
            name: 'Way of the Open Hand',
            description: 'Monks of the Way of the Open Hand are the ultimate masters of martial arts combat, whether armed or unarmed.',
            features: {
                3: [{ name: 'Open Hand Technique', description: 'When you hit a creature with one of the attacks granted by your Flurry of Blows, you can impose one of the following effects: push them away, knock them prone, or prevent them from taking reactions.' }],
            }
        },
        {
            name: 'Way of Shadow',
            description: 'Monks of the Way of Shadow follow a tradition that values stealth and subtlety. They are spies and assassins.',
            features: {
                3: [{ name: 'Shadow Arts', description: 'You can use your ki to cast minor illusion, darkness, pass without trace, and silence.' }],
            }
        },
        {
            name: 'Way of the Astral Self',
            description: 'Monks of the Way of the Astral Self see their ki as a representation of their true form. They can summon parts of this astral self to fight for them.',
            features: {
                3: [{ 
                    name: 'Arms of the Astral Self', 
                    description: 'As a bonus action, you can spend 1 ki point to summon spectral arms for 10 minutes. These arms let you use your Wisdom for Strength checks/saves. Your unarmed strikes with them have a 10-foot reach, use Wisdom for attack/damage, and deal force damage.' 
                }],
            }
        }
    ],
    [Class.Necromancer]: [
        {
            name: 'Lord of the Undead',
            description: 'You focus on strengthening your undead creations, turning them into formidable servants.',
            features: {
                3: [{ name: 'Undead Thralls', description: 'When you use Animate Dead, you can target one additional corpse or pile of bones, creating another zombie or skeleton.' }],
            }
        },
        {
            name: 'Reaper',
            description: 'You focus on spells that drain life force from your enemies, viewing death as a tool to sustain your own vitality.',
            features: {
                3: [{ name: 'Grim Harvest', description: 'You gain the ability to reap life energy from creatures you kill with your spells. Once per turn when you kill one or more creatures with a spell, you regain hit points.' }],
            }
        }
    ]
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