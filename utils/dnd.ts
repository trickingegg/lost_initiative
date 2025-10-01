import { Ability, Class } from "../types";
import { CLASSES_DATA } from "../constants";

export const calculateModifier = (score: number): number => {
    return Math.floor((score - 10) / 2);
};

export const getModifierString = (modifier: number): string => {
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
};

export const calculateProficiencyBonus = (level: number): number => {
    return Math.ceil(level / 4) + 1;
};

export const calculateMaxHp = (level: number, charClass: Class, conScore: number): number => {
    const conModifier = calculateModifier(conScore);
    const classData = CLASSES_DATA[charClass];
    if (level === 1) {
        return classData.hitDie + conModifier;
    }
    // Average roll, rounded up
    const averageHitDie = Math.ceil(classData.hitDie / 2) + 1;
    const firstLevelHp = classData.hitDie + conModifier;
    const additionalLevelsHp = (level - 1) * (averageHitDie + conModifier);
    return firstLevelHp + additionalLevelsHp;
};

// A simple AC calculation for demonstration. Real D&D is more complex.
// Base 10 + Dex modifier. A character would equip armor to change this.
export const calculateBaseAC = (dexScore: number): number => {
    return 10 + calculateModifier(dexScore);
};
