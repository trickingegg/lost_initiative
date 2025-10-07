import { Character, Item, Quest } from "../types";
import { XP_THRESHOLDS } from "../constants";
import { calculateMaxHp } from "./dnd";

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

const checkLevelUp = (character: Character): Character => {
    let newCharacter = { ...character };
    // Use a while loop in case of multiple level-ups from a large XP gain
    while (newCharacter.level < XP_THRESHOLDS.length && newCharacter.xp >= XP_THRESHOLDS[newCharacter.level]) {
        const oldMaxHp = calculateMaxHp(newCharacter.level, newCharacter.class, newCharacter.abilities.Constitution);
        newCharacter.level += 1;
        const newMaxHp = calculateMaxHp(newCharacter.level, newCharacter.class, newCharacter.abilities.Constitution);
        const hpGained = newMaxHp - oldMaxHp;
        newCharacter.hp.max = newMaxHp;
        newCharacter.hp.current += hpGained;
    }
    return newCharacter;
};

export const processCharacterCommands = (character: Character, commands: string[]): Character => {
    let updatedCharacter = { ...character };

    commands.forEach(command => {
        const match = command.match(/^\[([A-Z_]+):(.*)\]$/);
        if (!match) return;

        const [, type, value] = match;
        const args = value.split(',').map(arg => arg.trim().replace(/"/g, ''));

        switch (type) {
            case 'DAMAGE':
                updatedCharacter.hp.current = Math.max(0, updatedCharacter.hp.current - parseInt(args[0]));
                break;
            case 'HEAL':
                updatedCharacter.hp.current = Math.min(updatedCharacter.hp.max, updatedCharacter.hp.current + parseInt(args[0]));
                break;
            case 'ADD_XP':
                updatedCharacter.xp += parseInt(args[0]);
                updatedCharacter = checkLevelUp(updatedCharacter);
                break;
            case 'ADD_GOLD':
                updatedCharacter.gold += parseInt(args[0]);
                break;
            case 'ADD_ITEM':
                if (args.length === 2) {
                    updatedCharacter = handleAddItem(updatedCharacter, args[0], parseInt(args[1]));
                }
                break;
            case 'REMOVE_ITEM':
                 if (args.length === 2) {
                    updatedCharacter = handleRemoveItem(updatedCharacter, args[0], parseInt(args[1]));
                }
                break;
            case 'SET_QUEST':
                if (args.length === 2) {
                    updatedCharacter = handleSetQuest(updatedCharacter, args[0], args[1]);
                }
                break;
            case 'CAST_SPELL':
                const spellLevel = parseInt(args[1]);
                if (updatedCharacter.spellSlots[spellLevel] && updatedCharacter.spellSlots[spellLevel].current > 0) {
                    const newSlots = { ...updatedCharacter.spellSlots };
                    newSlots[spellLevel].current -= 1;
                    updatedCharacter.spellSlots = newSlots;
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
                break;
            default:
                console.warn(`Unknown command type: ${type}`);
        }
    });

    return updatedCharacter;
};