import { Character, Item, Quest, Class, AwaitingLevelUpChoices } from "../types";
import { XP_THRESHOLDS, FULL_CASTER_SPELL_SLOTS, ARCHETYPES_DATA } from "../constants";
import { calculateMaxHp } from "./dnd";

const COIN_TYPES = [
    { name: 'Platinum Pieces', value: 1000 },
    { name: 'Gold Pieces', value: 100 },
    { name: 'Silver Pieces', value: 10 },
    { name: 'Copper Pieces', value: 1 },
];
const COIN_NAMES = COIN_TYPES.map(c => c.name);

const consolidateCurrency = (inventory: Item[]): Item[] => {
    let totalCopperValue = 0;
    const nonCoinInventory = inventory.filter(item => {
        if (COIN_NAMES.includes(item.name)) {
            const coinType = COIN_TYPES.find(c => c.name === item.name);
            if (coinType) {
                totalCopperValue += item.quantity * coinType.value;
            }
            return false; // Remove coin from inventory for now
        }
        return true;
    });

    const newCoinInventory: Item[] = [];
    if (totalCopperValue > 0) {
        for (const coinType of COIN_TYPES) {
            if (totalCopperValue >= coinType.value) {
                const amount = Math.floor(totalCopperValue / coinType.value);
                newCoinInventory.push({ name: coinType.name, quantity: amount });
                totalCopperValue %= coinType.value;
            }
        }
    }
    
    // Put coins at the top of the inventory list
    return [...newCoinInventory, ...nonCoinInventory];
};

const handleAddItem = (character: Character, itemName: string, quantity: number): Character => {
    const existingItem = character.inventory.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    let newInventory: Item[];

    if (existingItem) {
        newInventory = character.inventory.map(i =>
            i.name.toLowerCase() === itemName.toLowerCase()
                ? { ...i, quantity: i.quantity + quantity }
                : i
        );
    } else {
        newInventory = [...character.inventory, { name: itemName, quantity }];
    }

    return { ...character, inventory: newInventory };
};

const handleRemoveItem = (character: Character, itemName: string, quantity: number): Character => {
    const newInventory = character.inventory
        .map(i => {
            if (i.name.toLowerCase() === itemName.toLowerCase()) {
                return { ...i, quantity: i.quantity - quantity };
            }
            return i;
        })
        .filter(i => i.quantity > 0);
    return { ...character, inventory: newInventory };
};

const handleSetQuest = (character: Character, title: string, description: string): Character => {
    const existingQuest = character.quests.find(q => q.title.toLowerCase() === title.toLowerCase());
    let newQuests: Quest[];

    if (existingQuest) {
        newQuests = character.quests.map(q =>
            q.title.toLowerCase() === title.toLowerCase()
                ? { ...q, description, isActive: true }
                : q
        );
    } else {
        newQuests = [...character.quests, { title, description, isActive: true }];
    }
    
    return { ...character, quests: newQuests };
};

const checkLevelUp = (character: Character): {char: Character, choices: AwaitingLevelUpChoices | null} => {
    let newCharacter = { ...character };
    let levelUpChoices: AwaitingLevelUpChoices | null = null;
    let newLevel = newCharacter.level;
    
    // Use a while loop in case of multiple level-ups from a large XP gain
    while (newLevel < XP_THRESHOLDS.length && newCharacter.xp >= XP_THRESHOLDS[newLevel]) {
        const oldMaxHp = calculateMaxHp(newLevel, newCharacter.class, newCharacter.abilities.Constitution);
        newLevel += 1;
        
        const newMaxHp = calculateMaxHp(newLevel, newCharacter.class, newCharacter.abilities.Constitution);
        const hpGained = newMaxHp - oldMaxHp;
        
        // Accumulate choices only for the first level gained in this check
        if (!levelUpChoices) {
            levelUpChoices = { level: newLevel };
            
            // Level 3 Archetype Choice
            if (newLevel === 3 && !newCharacter.archetype) {
                const archetypeOptions = ARCHETYPES_DATA[newCharacter.class];
                if (archetypeOptions) {
                    levelUpChoices.archetypeChoice = { from: archetypeOptions };
                }
            }
            
            // Add spell choice for wizards/necromancers on level up
            const isWizardLike = [Class.Wizard, Class.Necromancer].includes(newCharacter.class);
            if (isWizardLike) {
                // Wizards learn 2 spells per level up
                levelUpChoices.spellChoice = { count: 2 };
            }
        }
        
        // Apply cumulative stat gains
        newCharacter.hp.max += hpGained;
        newCharacter.hp.current += hpGained;

    }

    if(levelUpChoices) {
        newCharacter.level = levelUpChoices.level;
         // Update spell slots for full casters if a level up occurred
        const isFullCaster = [Class.Wizard, Class.Cleric, Class.Necromancer].includes(newCharacter.class);
        if (isFullCaster && FULL_CASTER_SPELL_SLOTS[newCharacter.level as keyof typeof FULL_CASTER_SPELL_SLOTS]) {
            const slotsForLevel = FULL_CASTER_SPELL_SLOTS[newCharacter.level as keyof typeof FULL_CASTER_SPELL_SLOTS];
            const newSpellSlots = { ...newCharacter.spellSlots };
            
            Object.keys(slotsForLevel).forEach(spellLevelStr => {
                const spellLevel = parseInt(spellLevelStr);
                const maxSlots = slotsForLevel[spellLevel as keyof typeof slotsForLevel];
                // On level up, spell slots are restored.
                newSpellSlots[spellLevel] = { current: maxSlots, max: maxSlots };
            });
            newCharacter.spellSlots = newSpellSlots;
        }
        // Update Ki points for monks
        if (newCharacter.class === Class.Monk) {
            newCharacter.ki = { current: newCharacter.level, max: newCharacter.level };
        }
    }


    return { char: newCharacter, choices: levelUpChoices };
};


export const processCharacterCommands = (character: Character, commands: string[]): { updatedCharacter: Character, logs: string[], levelUpChoices: AwaitingLevelUpChoices | null } => {
    let updatedCharacter = { ...character };
    const logs: string[] = [];
    let levelUpChoices: AwaitingLevelUpChoices | null = null;

    commands.forEach(command => {
        const match = command.match(/^\[([A-Z_]+):(.*)\]$/);
        if (!match) return;

        const [, type, value] = match;
        const args = value.split(',').map(arg => arg.trim().replace(/"/g, ''));

        switch (type) {
            case 'DAMAGE':
                updatedCharacter.hp.current = Math.max(0, updatedCharacter.hp.current - parseInt(args[0]));
                logs.push(`Took ${args[0]} damage.`);
                break;
            case 'HEAL':
                updatedCharacter.hp.current = Math.min(updatedCharacter.hp.max, updatedCharacter.hp.current + parseInt(args[0]));
                 logs.push(`Healed for ${args[0]} HP.`);
                break;
            case 'ADD_XP':
                updatedCharacter.xp += parseInt(args[0]);
                logs.push(`+${args[0]} XP`);
                const levelUpResult = checkLevelUp(updatedCharacter);
                updatedCharacter = levelUpResult.char;
                if (levelUpResult.choices) {
                    levelUpChoices = levelUpResult.choices;
                    logs.push(`Leveled up to level ${levelUpResult.choices.level}!`);
                }
                break;
            case 'ADD_ITEM':
                if (args.length === 2) {
                    updatedCharacter = handleAddItem(updatedCharacter, args[0], parseInt(args[1]));
                    logs.push(`Received: ${args[0]} (x${args[1]})`);
                }
                break;
            case 'REMOVE_ITEM':
                 if (args.length === 2) {
                    updatedCharacter = handleRemoveItem(updatedCharacter, args[0], parseInt(args[1]));
                    logs.push(`Lost: ${args[0]} (x${args[1]})`);
                }
                break;
            case 'SET_QUEST':
                if (args.length === 2) {
                    updatedCharacter = handleSetQuest(updatedCharacter, args[0], args[1]);
                    logs.push(`Quest updated: ${args[0]}`);
                }
                break;
            case 'CAST_SPELL':
                const spellLevel = parseInt(args[1]);
                if (updatedCharacter.spellSlots[spellLevel] && updatedCharacter.spellSlots[spellLevel].current > 0) {
                    const newSlots = { ...updatedCharacter.spellSlots };
                    newSlots[spellLevel].current -= 1;
                    updatedCharacter.spellSlots = newSlots;
                    logs.push(`Cast ${args[0]} (Level ${spellLevel}).`);
                }
                break;
            case 'USE_KI':
                if (updatedCharacter.ki && updatedCharacter.ki.current > 0) {
                    const amount = parseInt(args[0]);
                    if (!isNaN(amount)) {
                        updatedCharacter.ki.current = Math.max(0, updatedCharacter.ki.current - amount);
                        logs.push(`Used ${amount} Ki point(s).`);
                    }
                }
                break;
            case 'LONG_REST':
                // Full heal
                updatedCharacter.hp.current = updatedCharacter.hp.max;
                // Restore all spell slots
                const restoredSlots = { ...updatedCharacter.spellSlots };
                for (const level in restoredSlots) {
                    restoredSlots[level].current = restoredSlots[level].max;
                }
                updatedCharacter.spellSlots = restoredSlots;
                
                let restMessage = 'Completed a long rest. HP and spell slots restored.';
                if (updatedCharacter.ki) {
                    updatedCharacter.ki.current = updatedCharacter.ki.max;
                    restMessage = 'Completed a long rest. HP, spell slots and Ki points restored.';
                }
                logs.push(restMessage);
                break;
            default:
                console.warn(`Unknown command type: ${type}`);
        }
    });

    updatedCharacter.inventory = consolidateCurrency(updatedCharacter.inventory);

    return { updatedCharacter, logs, levelUpChoices };
};