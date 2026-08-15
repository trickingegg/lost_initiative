import { Ability } from '../types';
import type { Character as FormCharacter } from '../types';
import type { AbilityScores, Character as ApiCharacter } from './types';

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
        quests: form.quests.map((quest) => ({
            title: quest.title,
            description: quest.description,
            status: quest.isActive ? 'active' : 'completed',
        })),
    };
}

export function abilityScore(abilities: AbilityScores, name: string): number {
    const key = name.trim().toLowerCase() as keyof AbilityScores;
    const value = abilities[key];
    return typeof value === 'number' ? value : 10;
}
