import { Character, Item, Quest } from "../types";
import { XP_THRESHOLDS } from "../constants";

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
    if (character.level >= XP_THRESHOLDS.length) return character;
    
    const nextLevelXp = XP_THRESHOLDS[character.level];
    if (character.xp >= nextLevelXp) {
        return { ...character, level: character.level + 1 };
        // In a more complex system, this would trigger HP increase, new spells, etc.
    }
    return character;
};


export const processCommands = (character: Character, commands: string[]): Character => {
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
            default:
                console.warn(`Unknown command type: ${type}`);
        }
    });

    return updatedCharacter;
};
