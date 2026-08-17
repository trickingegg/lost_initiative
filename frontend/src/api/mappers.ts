import { Ability } from '../types';
import type { Character as FormCharacter } from '../types';
import type { AbilityScores, Character as ApiCharacter, RollRequest } from './types';

export const SKILL_ABILITY: Record<string, keyof AbilityScores> = {
    acrobatics: 'dexterity',
    'animal handling': 'wisdom',
    arcana: 'intelligence',
    athletics: 'strength',
    deception: 'charisma',
    history: 'intelligence',
    insight: 'wisdom',
    intimidation: 'charisma',
    investigation: 'intelligence',
    medicine: 'wisdom',
    nature: 'intelligence',
    perception: 'wisdom',
    performance: 'charisma',
    persuasion: 'charisma',
    religion: 'intelligence',
    'sleight of hand': 'dexterity',
    stealth: 'dexterity',
    survival: 'wisdom',
};

const ABILITY_ALIASES: Record<string, keyof AbilityScores> = {
    str: 'strength',
    strength: 'strength',
    dex: 'dexterity',
    dexterity: 'dexterity',
    con: 'constitution',
    constitution: 'constitution',
    int: 'intelligence',
    intelligence: 'intelligence',
    wis: 'wisdom',
    wisdom: 'wisdom',
    cha: 'charisma',
    charisma: 'charisma',
};

export function abilityScore(abilities: AbilityScores, name: string): number {
    const key = name.trim().toLowerCase() as keyof AbilityScores;
    const aliased = ABILITY_ALIASES[key] || key;
    const value = abilities[aliased];
    return typeof value === 'number' ? value : 10;
}

export function rollModifier(
    character: ApiCharacter,
    awaitingRoll: RollRequest,
): { abilityMod: number; proficiency: number; total: number; skillName: string | null } {
    if (awaitingRoll.type === 'DEATH_SAVE') {
        return { abilityMod: 0, proficiency: 0, total: 0, skillName: null };
    }
    const raw = awaitingRoll.ability.trim().toLowerCase();
    const skillName = Object.keys(SKILL_ABILITY).find((skill) => skill === raw) || null;
    const abilityName = skillName ? SKILL_ABILITY[skillName] : (ABILITY_ALIASES[raw] || 'strength');
    const abilityMod = calculateModifierFromScore(abilityScore(character.abilities, abilityName));
    const proficientSkill = skillName
        ? character.skills.some((skill) => skill.trim().toLowerCase() === skillName)
        : false;
    const attackProficiency = awaitingRoll.type === 'ATTACK_ROLL' ? character.proficiency_bonus : 0;
    const skillProficiency = proficientSkill ? character.proficiency_bonus : 0;
    const proficiency = skillProficiency || attackProficiency;
    return { abilityMod, proficiency, total: abilityMod + proficiency, skillName };
}

function calculateModifierFromScore(score: number): number {
    return Math.floor((score - 10) / 2);
}

export function toApiCharacter(form: FormCharacter): Partial<ApiCharacter> {
    const abilities: AbilityScores = {
        strength: form.abilities[Ability.Strength],
        dexterity: form.abilities[Ability.Dexterity],
        constitution: form.abilities[Ability.Constitution],
        intelligence: form.abilities[Ability.Intelligence],
        wisdom: form.abilities[Ability.Wisdom],
        charisma: form.abilities[Ability.Charisma],
    };

    const spellSlots: Record<string, { current: number; maximum: number }> = {};
    Object.entries(form.spellSlots || {}).forEach(([level, slot]) => {
        spellSlots[level] = { current: slot.current, maximum: slot.max };
    });

    return {
        name: form.name,
        race: form.race,
        char_class: form.class === 'Custom' && form.classDescription
            ? form.classDescription
            : form.class,
        subclass: form.archetype?.name ?? null,
        background: form.background,
        level: form.level,
        xp: form.xp,
        hp_current: form.hp.current,
        hp_max: form.hp.max,
        ac: form.ac,
        speed: form.speed,
        abilities,
        skills: form.skills,
        features: form.features.map((feature) => ({
            name: feature.name,
            description: feature.description,
        })),
        inventory: form.inventory.map((item) => ({
            name: item.name,
            quantity: item.quantity,
        })),
        spells_known: form.spells.map((spell) => spell.name),
        spell_slots: spellSlots,
        ki_current: form.ki?.current ?? null,
        ki_max: form.ki?.max ?? null,
        conditions: [],
        death_saves: { successes: 0, failures: 0 },
        hit_dice_current: form.level,
        hit_dice_max: form.level,
        quests: form.quests.map((quest) => ({
            title: quest.title,
            description: quest.description,
            status: quest.isActive ? 'active' : 'completed',
        })),
    };
}
