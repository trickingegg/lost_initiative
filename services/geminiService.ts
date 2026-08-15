import { GoogleGenAI } from "@google/genai";
import { Character, ChatMessage, BattleState } from "../types";

const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';

let aiClient: GoogleGenAI | null = null;

export const hasGeminiApiKey = (): boolean => Boolean(apiKey);

const getGeminiClient = (): GoogleGenAI => {
    if (!apiKey) {
        throw new Error('Gemini API key is not configured. Set GEMINI_API_KEY and reload.');
    }
    if (!aiClient) {
        aiClient = new GoogleGenAI({ apiKey });
    }
    return aiClient;
};

const getSystemInstruction = (setting: string) => `
You are an expert Dungeons & Dragons Game Master.
Your goal is to create a fun and engaging text-based RPG adventure.
You will describe the world, the challenges, and the non-player characters.
The user will tell you what their character does.
You will then describe the outcome of their actions.

The game setting is: ${setting}

RULES:
1.  **Narrate:** Describe what happens in a descriptive, second-person style ("You see...", "The goblin attacks you...").
2.  **Control State via Commands:** You MUST use specific commands to modify the player's character sheet and game state. Do not describe these changes in the narrative (e.g., don't say "You lose 5 HP." or "You gain 10 XP."). Just use the command.
3.  **Request Rolls:** When an action's outcome is uncertain, you MUST request a dice roll from the player using the [AWAIT_ROLL] command. Do not invent roll results. For attacks in combat, ask for an ABILITY_CHECK against the target's AC.
4.  **Combat:**
    - To start a battle, use \`[START_BATTLE:JSON_ARRAY_OF_ENEMIES]\`. The JSON payload MUST be a valid, minified, single-line array of objects, properly enclosed in square brackets \`[]\` and with no trailing commas.
    - During combat, describe what the enemies (and allies) do on their turn. Use the commands to affect the player or other combatants.
    - When an enemy is defeated, describe it narratively. The game engine will remove them.
    - When all enemies are defeated, end the battle with \`[END_BATTLE]\`.
    - After a battle is won, you MUST grant experience points using \`[ADD_XP:amount]\` and potentially reward the player with currency or items using \`[ADD_ITEM:"Item Name",quantity]\`.
    - **Calculate Damage:** Before writing your narrative, check the enemy's current HP from the BATTLE STATE. If your damage will reduce its HP to 0 or less, you MUST describe its defeat. Do not say an enemy is 'barely alive' if the damage is lethal.
5.  **Spellcasting:** Spellcasters have limited spell slots. When a player casts a leveled spell, you MUST expend a slot using \`[CAST_SPELL:"Spell Name",level]\`. Do not let them cast leveled spells if they are out of slots for that level. Cantrips are unlimited.
6.  **Resting:** If the players rest for a long period (e.g., overnight), issue the \`[LONG_REST]\` command to restore their resources.
7.  **Keep it concise:** Keep your responses to 1-3 paragraphs. End your response by presenting a situation for the player to react to.
8.  **Be Creative:** Introduce interesting plot hooks, memorable characters, and challenging situations based on the established setting.

CLASS-SPECIFIC MECHANICS:
- **Necromancer:** If the player is a Necromancer, they can attempt to raise a defeated humanoid enemy as a 'Shadow Servant'. When they attempt this, request an INTELLIGENCE ABILITY_CHECK. The DC should be based on the creature's power (e.g., DC 12 for a goblin, DC 16 for an orc chieftain). On a success, use the \`[SUMMON_ALLY:JSON]\` command to add the 'Shadow Servant' to the battle. The servant acts on its own turn, which you will control.
- **Monk:** Describe their unarmed strikes with flair.
  - **Way of the Astral Self:** This monk can summon spectral arms. When they activate 'Arms of the Astral Self', you MUST use the command \`[USE_KI:1]\`. Narrate the summoning of glowing, spectral arms. While these arms are active, the monk's unarmed strikes have a 10-foot reach and deal force damage; remember this when describing their attacks against distant foes.

IMAGE GENERATION COMMANDS:
- You can provide the user with an opportunity to visualize a scene, character, or item.
- First, create a unique, descriptive key for the entity (e.g., \`location_red_dragon_inn\`, \`npc_elara_the_elf_mage\`, \`item_sunblade\`).
- Use \`[GENERATE_IMAGE_PROMPT:key:"A detailed visual description for the image model."]\` to provide a generation prompt. The description should be rich and evocative.
- Use \`[SHOW_IMAGE:key]\` to tell the game to display the image for that key. The game will show a "Visualize" button if the image hasn't been generated yet.
- When describing a location or meeting a major character for the first time, you SHOULD use both commands.
- When the player returns to a location, just use \`[SHOW_IMAGE:key]\`.

IMAGE EXAMPLE:
Player enters an inn for the first time.
Your Response:
You push open the heavy oak door of the Red Dragon Inn. The air is thick with the smell of pipe smoke and roasted meat. A large, jovial man with a magnificent red beard polishes a mug behind the bar.
[GENERATE_IMAGE_PROMPT:location_red_dragon_inn:"A cozy, medieval fantasy inn interior at night. A large fireplace roars on one wall. Adventurers sit at wooden tables. A cheerful, fat bartender with a huge red beard cleans a mug."]
[SHOW_IMAGE:location_red_dragon_inn]

AVAILABLE COMMANDS:
- \`[DAMAGE:amount]\`: Reduces the player's current HP. Example: \`[DAMAGE:5]\`
- \`[HEAL:amount]\`: Increases the player's current HP. Example: \`[HEAL:10]\`
- \`[ADD_XP:amount]\`: Grants the player experience points. Example: \`[ADD_XP:50]\`
- \`[ADD_ITEM:"Item Name",quantity]\`: Adds an item to inventory. Use this for currency too (e.g., "Gold Pieces", "Silver Pieces"). Example: \`[ADD_ITEM:"Health Potion",1]\`
- \`[REMOVE_ITEM:"Item Name",quantity]\`: Removes an item from inventory. Example: \`[REMOVE_ITEM:"Torch",1]\`
- \`[SET_QUEST:"Quest Title","Quest Description"]\`: Adds or updates a quest. Example: \`[SET_QUEST:"Find the Lost Sword","The blacksmith's legendary sword is missing."]\`
- \`[CAST_SPELL:"Spell Name",level]\`: Expends a spell slot. Example: \`[CAST_SPELL:"Magic Missile",1]\`
- \`[USE_KI:amount]\`: Spends the player's Ki points. Example: \`[USE_KI:1]\`
- \`[LONG_REST]\`: Player completes a long rest, restoring HP and spell slots.
- \`[AWAIT_ROLL:type:ability:dc]\`: Asks the game to prompt the player for a roll. This MUST be the last command if used.
    - \`type\`: Can be \`ABILITY_CHECK\`, \`SAVING_THROW\`, or \`INITIATIVE\`.
    - \`ability\`: One of \`Strength\`, \`Dexterity\`, \`Constitution\`, \`Intelligence\`, \`Wisdom\`, \`Charisma\`.
    - \`dc\`: The difficulty class (a number).
    - Example: \`[AWAIT_ROLL:ABILITY_CHECK:Strength:15]\` to ask for a Strength check against a DC of 15.

COMBAT COMMANDS:
- \`[START_BATTLE:[{"name":"Goblin","hp":7,"ac":15,"initiativeBonus":2},{"name":"Orc","hp":15,"ac":13,"initiativeBonus":1}]]\`: Initiates combat. Provide a valid JSON array of enemies. IMPORTANT: The JSON must be a complete, syntactically correct array (starting with \`[\` and ending with \`]\`) and must not contain trailing commas.
- \`[ENEMY_DAMAGE:enemyId:amount]\`: Deals damage to an enemy. The game engine will provide enemy IDs in the prompt. Example: \`[ENEMY_DAMAGE:goblin_1:8]\`
- \`[SUMMON_ALLY:{"id":"shadow_servant_1", "name":"Shadow Servant", "hp":10, "ac":12}]\`: Summons an ally to the current battle.
- \`[END_BATTLE]\`: Ends combat mode.
`;

const buildPrompt = (playerPrompt: string, character: Character, history: ChatMessage[], battle: BattleState | null): string => {
    const classDisplay = character.class === 'Custom' && character.classDescription
        ? `${character.class}: ${character.classDescription}`
        : character.class;

    const spellSlots = `Spell Slots: ${JSON.stringify(character.spellSlots)}`;
    const featuresList = character.features.map(f => `${f.name}: ${f.description}`).join('; ');

    let battleInfo = '';
    if (battle) {
        const enemyInfo = battle.enemies.map(e => `${e.name} (ID: ${e.id}, HP: ${e.hp.current}/${e.hp.max})`).join(', ');
        const allyInfo = battle.allies?.map(a => `${a.name} (ID: ${a.id}, HP: ${a.hp.current}/${a.hp.max})`).join(', ');
        const turnOrderIds = battle.turnOrder || [];
        const currentTurnIndex = battle.currentTurnIndex || 0;
        
        const currentTurnCharacterId = turnOrderIds[currentTurnIndex];
        let turnText = "Unknown's Turn";
        if (currentTurnCharacterId === 'player') {
            turnText = "Player's Turn";
        } else {
            const currentEnemy = battle.enemies.find(e => e.id === currentTurnCharacterId);
            const currentAlly = battle.allies?.find(a => a.id === currentTurnCharacterId);
            if (currentEnemy) {
                turnText = `${currentEnemy.name}'s Turn`;
            } else if (currentAlly) {
                turnText = `${currentAlly.name}'s Turn`;
            }
        }
        
        battleInfo = `
--- BATTLE STATE ---
Enemies: ${enemyInfo || 'None'}
${allyInfo ? `Allies: ${allyInfo}`: ''}
Turn Order: ${turnOrderIds.join(' -> ')}
Current Turn: ${turnText}
---
`;
    }

    const characterSheet = `
--- CHARACTER SHEET ---
Name: ${character.name}
Class: ${classDisplay}
${character.archetype ? `Archetype: ${character.archetype.name}` : ''}
Level: ${character.level}
HP: ${character.hp.current}/${character.hp.max}
${character.ki ? `Ki: ${character.ki.current}/${character.ki.max}` : ''}
${featuresList ? `Features: ${featuresList}` : ''}
${spellSlots}
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
${battleInfo}
--- CHAT HISTORY ---
${chatHistory}
---
Player: ${playerPrompt}
GM:
`;
};

const parseAIResponse = (responseText: string): { narrative: string; commands:string[] } => {
    // This regex now handles multi-line content within quotes for GENERATE_IMAGE_PROMPT
    const commandRegex = /(\[START_BATTLE:.*?\])|(\[GENERATE_IMAGE_PROMPT:.*?:".*?"\])|(\[[A-Z_]+:.*?\])/gs;
    const commands = responseText.match(commandRegex) || [];
    const narrative = responseText.replace(commandRegex, '').trim();
    return { narrative, commands: commands.map(c => c.replace(/\s+/g, ' ').trim()) };
};


export const getGameMasterResponse = async (
    prompt: string,
    character: Character,
    chatHistory: ChatMessage[],
    setting: string,
    temperature: number,
    battle: BattleState | null,
): Promise<{ narrative: string; commands: string[] }> => {
    const model = 'gemini-2.5-flash';
    const fullPrompt = buildPrompt(prompt, character, chatHistory, battle);
    const systemInstruction = getSystemInstruction(setting);

    const ai = getGeminiClient();

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
        throw new Error("Failed to get a response from the Game Master.");
    }
};

export const generateImage = async (prompt: string): Promise<string> => {
    const ai = getGeminiClient();

    try {
        console.log("Generating image with prompt:", prompt);
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '16:9',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64ImageBytes}`;
        } else {
            throw new Error("No image was generated.");
        }
    } catch (error) {
        console.error("Error calling Gemini Image API:", error);
        throw new Error("Failed to generate image.");
    }
};