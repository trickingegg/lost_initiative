import { GoogleGenAI } from "@google/genai";
import { Character, ChatMessage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const getSystemInstruction = (setting: string) => `
You are an expert Dungeons & Dragons Game Master.
Your goal is to create a fun and engaging text-based RPG adventure.
You will describe the world, the challenges, and the non-player characters.
The user will tell you what their character does.
You will then describe the outcome of their actions.

The game setting is: ${setting}

RULES:
1.  **Narrate:** Describe what happens in a descriptive, second-person style ("You see...", "The goblin attacks you...").
2.  **Control State via Commands:** You MUST use specific commands to modify the player's character sheet. The game engine will handle these commands. Do not describe these changes in the narrative (e.g., don't say "You lose 5 HP." or "You gain 10 XP."). Just use the command.
3.  **Request Rolls:** When an action's outcome is uncertain, you MUST request a dice roll from the player using the [AWAIT_ROLL] command. The game will pause and wait for the player to roll. Do not invent roll results.
4.  **Keep it concise:** Keep your responses to 1-3 paragraphs. End your response by presenting a situation for the player to react to.
5.  **Be Creative:** Introduce interesting plot hooks, memorable characters, and challenging situations based on the established setting.

CLASS-SPECIFIC MECHANICS:
- **Necromancer:** If the player is a Necromancer, they can attempt to raise a defeated humanoid enemy as a 'Shadow Servant'. When they attempt this, request an INTELLIGENCE ABILITY_CHECK. The DC should be based on the creature's power (e.g., DC 12 for a goblin, DC 16 for an orc chieftain). On a success, they gain a temporary ally that you manage narratively. The shadow is destroyed if it takes significant damage.
- **Monk:** Describe their unarmed strikes with flair. Mention their potential to summon astral arms in the future when they achieve greater power.

AVAILABLE COMMANDS:
- \`[DAMAGE:amount]\`: Reduces the player's current HP. Example: \`[DAMAGE:5]\`
- \`[HEAL:amount]\`: Increases the player's current HP. Example: \`[HEAL:10]\`
- \`[ADD_XP:amount]\`: Grants the player experience points. Example: \`[ADD_XP:50]\`
- \`[ADD_GOLD:amount]\`: Gives gold to the player. Example: \`[ADD_GOLD:25]\`
- \`[ADD_ITEM:"Item Name",quantity]\`: Adds an item to inventory. Example: \`[ADD_ITEM:"Health Potion",1]\`
- \`[REMOVE_ITEM:"Item Name",quantity]\`: Removes an item from inventory. Example: \`[REMOVE_ITEM:"Torch",1]\`
- \`[SET_QUEST:"Quest Title","Quest Description"]\`: Adds or updates a quest. Example: \`[SET_QUEST:"Find the Lost Sword","The blacksmith's legendary sword is missing."]\`
- \`[AWAIT_ROLL:type:ability:dc]\`: Asks the game to prompt the player for a roll. This MUST be the last command if used.
    - \`type\`: Can be \`ABILITY_CHECK\` or \`SAVING_THROW\`.
    - \`ability\`: One of \`Strength\`, \`Dexterity\`, \`Constitution\`, \`Intelligence\`, \`Wisdom\`, \`Charisma\`.
    - \`dc\`: The difficulty class (a number).
    - Example: \`[AWAIT_ROLL:ABILITY_CHECK:Strength:15]\` to ask for a Strength check against a DC of 15.

EXAMPLE SCENARIO:
Player says: "I try to break down the door."
Your Response:
The old wooden door groans under your shoulder, but holds firm. It looks tough.
[AWAIT_ROLL:ABILITY_CHECK:Strength:15]

Player says: (After rolling 18) "My character rolled a total of 18 for their Strength ability check against a DC of 15. Describe what happens now."
Your Response:
With a final, mighty heave, the door splinters and bursts open! You stumble into a dusty room. In the center, you see a treasure chest.
[ADD_XP:25]
`;

const buildPrompt = (playerPrompt: string, character: Character, history: ChatMessage[]): string => {
    const classDisplay = character.class === 'Custom' && character.classDescription
        ? `${character.class}: ${character.classDescription}`
        : character.class;

    const characterSheet = `
--- CHARACTER SHEET ---
Name: ${character.name}
Class: ${classDisplay}
Level: ${character.level}
HP: ${character.hp.current}/${character.hp.max}
Abilities: ${JSON.stringify(character.abilities)}
Inventory: ${JSON.stringify(character.inventory)}
Quests: ${JSON.stringify(character.quests)}
---
`;

    const chatHistory = history
        .map(msg => `${msg.sender === 'gm' ? 'GM' : 'Player'}: ${msg.text}`)
        .join('\n');

    return `
${characterSheet}
--- CHAT HISTORY ---
${chatHistory}
---
Player: ${playerPrompt}
GM:
`;
};

const parseAIResponse = (responseText: string): { narrative: string; commands: string[] } => {
    const commandRegex = /\[[A-Z_]+:.*\]/g;
    const commands = responseText.match(commandRegex) || [];
    const narrative = responseText.replace(commandRegex, '').trim();
    return { narrative, commands };
};

export const getGameMasterResponse = async (
    prompt: string,
    character: Character,
    chatHistory: ChatMessage[],
    setting: string,
    temperature: number
): Promise<{ narrative: string; commands: string[] }> => {
    const model = 'gemini-2.5-flash';
    const fullPrompt = buildPrompt(prompt, character, chatHistory);
    const systemInstruction = getSystemInstruction(setting);

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: fullPrompt,
            config: {
                systemInstruction: systemInstruction,
                temperature: temperature,
                topP: 1,
                topK: 1,
            },
        });
        
        const responseText = response.text;
        
        if (!responseText) {
            throw new Error("Empty response from AI");
        }

        console.log("AI Response:", responseText);
        return parseAIResponse(responseText);
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Failed to get response from the Game Master.");
    }
};