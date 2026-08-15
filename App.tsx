import React, { useState, useEffect, useCallback } from 'react';
import { Character, GameState, Screen, AwaitingRollState, RollType, Ability, BattleState, Spell, Archetype, Class, AwaitingLevelUpChoices, Ally } from './types';
import CharacterCreationScreen from './components/CharacterCreationScreen';
import GameScreen from './components/GameScreen';
import AdventureSetupScreen from './components/AdventureSetupScreen';
import MainMenuScreen from './components/MainMenuScreen';
import SettingsScreen from './components/SettingsScreen';
import ConfirmationDialog from './components/ConfirmationDialog';
import LevelUpScreen from './components/LevelUpScreen';
import { getGameMasterResponse, generateImage, hasGeminiApiKey } from './services/geminiService';
import { processCharacterCommands } from './utils/commandProcessor';
import { ARCHETYPES_DATA } from './constants';

const App: React.FC = () => {
    const [gameState, setGameState] = useState<GameState>(() => {
        const savedSettings = localStorage.getItem('ai-game-master-settings');
        const settings = savedSettings ? JSON.parse(savedSettings) : { temperature: 0.9 };
        const savedImages = localStorage.getItem('ai-game-master-images');
        const imagesCache = savedImages ? JSON.parse(savedImages) : {};
        return {
            character: null,
            chatHistory: [],
            screen: Screen.Menu,
            isLoading: false,
            awaitingRoll: null,
            awaitingLevelUpChoices: null,
            gameId: 0,
            setting: null,
            temperature: settings.temperature,
            battle: null,
            imagesCache: imagesCache,
            imagePrompts: {},
            currentImageKey: null,
            isGeneratingImage: false,
        };
    });
    
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [saveFileExists, setSaveFileExists] = useState(false);

    useEffect(() => {
        const savedGame = localStorage.getItem('ai-game-master-save');
        setSaveFileExists(!!savedGame);
    }, []);

    // Effect to handle enemy/ally turns in battle
    useEffect(() => {
        const { battle, isLoading, awaitingRoll, character, chatHistory, awaitingLevelUpChoices } = gameState;
        if (battle && battle.turnOrder.length > 0 && !isLoading && !awaitingRoll && !awaitingLevelUpChoices && character) {
            const currentTurnId = battle.turnOrder[battle.currentTurnIndex];
            if (currentTurnId !== 'player') {
                const enemy = battle.enemies.find(e => e.id === currentTurnId);
                const ally = battle.allies.find(a => a.id === currentTurnId);
                const combatant = enemy || ally;
                if (combatant) {
                    const aiPrompt = `It is now ${combatant.name}'s turn. What do they do?`;
                    processAITurn(aiPrompt, chatHistory);
                }
            }
        }
    }, [gameState.battle?.currentTurnIndex, gameState.isLoading, gameState.battle?.turnOrder]);


    const handleSaveGame = () => {
        if (gameState.character && gameState.setting) {
            try {
                const stateToSave = {
                    character: gameState.character,
                    chatHistory: gameState.chatHistory,
                    setting: gameState.setting,
                    battle: gameState.battle,
                    imagePrompts: gameState.imagePrompts,
                    currentImageKey: gameState.currentImageKey,
                };
                localStorage.setItem('ai-game-master-save', JSON.stringify(stateToSave));
                localStorage.setItem('ai-game-master-images', JSON.stringify(gameState.imagesCache));
                setSaveFileExists(true);
                alert('Game saved!');
            } catch (error) {
                console.error('Failed to save game:', error);
                alert('Error: Could not save game.');
            }
        }
    };

    const handleLoadGame = () => {
        try {
            const savedStateJSON = localStorage.getItem('ai-game-master-save');
            if (savedStateJSON) {
                const savedState = JSON.parse(savedStateJSON);
                const savedImages = localStorage.getItem('ai-game-master-images');
                const imagesCache = savedImages ? JSON.parse(savedImages) : {};

                setGameState(prev => ({
                    ...prev,
                    character: savedState.character,
                    chatHistory: savedState.chatHistory,
                    setting: savedState.setting,
                    battle: savedState.battle,
                    imagePrompts: savedState.imagePrompts || {},
                    currentImageKey: savedState.currentImageKey || null,
                    imagesCache: imagesCache,
                    screen: Screen.Game,
                    isLoading: false,
                    awaitingRoll: null,
                    awaitingLevelUpChoices: null,
                }));
            } else {
                alert('No saved game found.');
            }
        } catch (error) {
            console.error('Failed to load game:', error);
            alert('Error: Could not load game.');
        }
    };
    
    const handleSetupComplete = (setting: string) => {
        setGameState(prev => ({
            ...prev,
            setting: setting,
            screen: Screen.Creation,
        }));
    };

    const handleStartGame = async (character: Character) => {
        // If starting at level 3 or higher WITHOUT an archetype, show the choice screen first.
        if (character.level >= 3 && !character.archetype) {
            const archetypeOptions = ARCHETYPES_DATA[character.class];
            let choices: AwaitingLevelUpChoices = { level: character.level };
    
            if (archetypeOptions) {
                choices.archetypeChoice = { from: archetypeOptions };
            }
    
            const isWizardLike = [Class.Wizard, Class.Necromancer].includes(character.class);
            if (isWizardLike && character.level > 1) {
                // Wizards start with 6 spells at level 1, then learn 2 per level.
                // Creation screen gives them the first 6. This screen gives them the rest.
                const spellsToLearn = (character.level - 1) * 2;
                choices.spellChoice = { count: spellsToLearn };
            }
            
            // Don't start the game yet, wait for level up choices.
            setGameState(prev => ({
                ...prev,
                character,
                chatHistory: [],
                screen: Screen.Game,
                isLoading: false,
                awaitingRoll: null,
                awaitingLevelUpChoices: choices,
                battle: null,
                imagePrompts: {},
                currentImageKey: null,
            }));
        } else {
             // Original logic for characters starting at level 1 or 2
            setGameState(prev => ({
                ...prev,
                character,
                chatHistory: [],
                screen: Screen.Game,
                isLoading: true,
                awaitingRoll: null,
                awaitingLevelUpChoices: null,
                battle: null,
                imagePrompts: {},
                currentImageKey: null,
            }));
            
            await processAITurn("My adventure begins. Describe my starting location and situation.", [], character);
        }
    };

    const processAITurn = useCallback(async (
        promptForAI: string,
        currentHistory: GameState['chatHistory'],
        characterOverride?: Character
    ) => {
        const character = characterOverride || gameState.character;
        if (!character || !gameState.setting) return;
    
        setGameState(prev => ({ ...prev, isLoading: true, awaitingRoll: null }));
    
        try {
            const { narrative, commands } = await getGameMasterResponse(promptForAI, character, currentHistory, gameState.setting, gameState.temperature, gameState.battle);
    
            const relevantCommands = commands.filter(c => !c.startsWith('[GENERATE_IMAGE_PROMPT:') && !c.startsWith('[SHOW_IMAGE:'));
            const imagePromptCommands = commands.filter(c => c.startsWith('[GENERATE_IMAGE_PROMPT:'));
            const showImageCommand = commands.find(c => c.startsWith('[SHOW_IMAGE:'));

            const { updatedCharacter: characterAfterCommands, logs: commandLogs, levelUpChoices } = processCharacterCommands(character, relevantCommands);
            
            let newAwaitingRollState: AwaitingRollState | null = null;
            let newBattleState: BattleState | null = gameState.battle ? { ...gameState.battle } : null;
            let newCurrentImageKey: string | null = gameState.currentImageKey;
            const newImagePrompts = { ...gameState.imagePrompts };

            // Process Image Commands
            imagePromptCommands.forEach(cmd => {
                const match = cmd.match(/^\[GENERATE_IMAGE_PROMPT:(.*?):"(.*)"\]$/);
                if (match) {
                    const [, key, prompt] = match;
                    newImagePrompts[key] = prompt;
                }
            });

            if (showImageCommand) {
                const match = showImageCommand.match(/^\[SHOW_IMAGE:(.*)\]$/);
                if (match) {
                    newCurrentImageKey = match[1];
                }
            }


            // Process Battle Commands from AI response
            for (const command of relevantCommands) {
                 if (command.startsWith('[START_BATTLE:')) {
                    const jsonString = command.substring('[START_BATTLE:'.length, command.length - 1);
                    try {
                        let sanitizedJsonString = jsonString.replace(/,\s*([\]}])/g, '$1'); 
                        const trimmed = sanitizedJsonString.trim();
                        if (trimmed.startsWith('[') && !trimmed.endsWith(']')) {
                            sanitizedJsonString = trimmed + ']';
                        }
                        
                        const enemiesData = JSON.parse(sanitizedJsonString);
                        newBattleState = {
                            enemies: enemiesData.map((e: any, i: number) => ({
                                ...e,
                                id: `${e.name.toLowerCase().replace(/\s/g, '_')}_${i}`,
                                hp: { current: e.hp, max: e.hp },
                                initiative: 0,
                            })),
                            allies: [],
                            turnOrder: [],
                            currentTurnIndex: 0,
                        };
                        newAwaitingRollState = { type: RollType.INITIATIVE, ability: Ability.Dexterity, dc: 0 };
                    } catch (parseError) {
                        console.error('Failed to parse [START_BATTLE] JSON from AI:', jsonString);
                        console.error(parseError);
                    }
                } else if (command.startsWith('[ENEMY_DAMAGE:') && newBattleState) {
                    const match = command.match(/^\[ENEMY_DAMAGE:(.*?):(\d+)\]$/);
                    if (match) {
                        const [, enemyId, damage] = match;
                        newBattleState.enemies = newBattleState.enemies
                            .map(e => e.id === enemyId ? { ...e, hp: { ...e.hp, current: Math.max(0, e.hp.current - parseInt(damage)) } } : e)
                            .filter(e => e.hp.current > 0);
                    }
                } else if (command.startsWith('[END_BATTLE')) {
                    newBattleState = null;
                } else if (command.startsWith('[SUMMON_ALLY:') && newBattleState) {
                    const jsonString = command.substring('[SUMMON_ALLY:'.length, command.length - 1);
                     try {
                        const allyData = JSON.parse(jsonString) as Ally;
                        if (!newBattleState.allies) newBattleState.allies = [];
                        
                        newBattleState.allies.push(allyData);

                        const playerIndex = newBattleState.turnOrder.indexOf('player');
                        if (playerIndex > -1) {
                            newBattleState.turnOrder.splice(playerIndex + 1, 0, allyData.id);
                        } else {
                            newBattleState.turnOrder.push(allyData.id);
                        }
                        commandLogs.push(`${allyData.name} has joined the battle!`);

                    } catch (e) {
                        console.error('Failed to parse [SUMMON_ALLY] JSON from AI:', jsonString, e);
                    }
                }
            }
             
             if (newBattleState && newBattleState.enemies.length === 0) {
                 newBattleState = null;
                 commandLogs.push("Victory! All enemies have been defeated.");
             }

            const awaitRollCommand = relevantCommands.find(c => c.startsWith('[AWAIT_ROLL:'));
            if (awaitRollCommand && !newAwaitingRollState) {
                 const match = awaitRollCommand.match(/^\[AWAIT_ROLL:([A-Z_]+):([a-zA-Z]+):(\d+)\]$/);
                 if (match) {
                     const [, type, ability, dc] = match;
                     newAwaitingRollState = {
                         type: type as RollType,
                         ability: ability as Ability,
                         dc: parseInt(dc),
                     };
                 }
            }

            if (newBattleState && newBattleState.turnOrder.length > 0) {
                const currentTurnId = newBattleState.turnOrder[newBattleState.currentTurnIndex];
                if(currentTurnId !== 'player' && !newAwaitingRollState) {
                    newBattleState.currentTurnIndex = (newBattleState.currentTurnIndex + 1) % newBattleState.turnOrder.length;
                }
            }
    
            let tempHistory = [...currentHistory];
            if (narrative) {
                tempHistory.push({ sender: 'gm' as const, text: narrative });
            }
            if (commandLogs.length > 0) {
                commandLogs.forEach(log => {
                    tempHistory.push({ sender: 'system' as const, text: log });
                });
            }

            setGameState(prev => ({ 
                ...prev, 
                character: characterAfterCommands, 
                chatHistory: tempHistory, 
                isLoading: false,
                awaitingRoll: newAwaitingRollState,
                awaitingLevelUpChoices: levelUpChoices,
                battle: newBattleState,
                imagePrompts: newImagePrompts,
                currentImageKey: newCurrentImageKey
            }));
        } catch (error) {
            console.error('Error getting response from AI:', error);
            const errorText = error instanceof Error && /API key/i.test(error.message)
                ? 'The Game Master cannot speak: GEMINI_API_KEY is not configured. Set it in the environment and reload.'
                : 'The ancient magics are failing... (An error occurred). Please try again.';
            const errorHistory = [...currentHistory, { sender: 'gm' as const, text: errorText }];
            setGameState(prev => ({ ...prev, chatHistory: errorHistory, isLoading: false }));
        }
    }, [gameState.character, gameState.setting, gameState.temperature, gameState.battle, gameState.imagePrompts, gameState.currentImageKey]);

    const handleSendMessage = async (message: string) => {
        if (gameState.isLoading || gameState.awaitingRoll) return;
        const newHistory = [...gameState.chatHistory, { sender: 'player' as const, text: message }];
        setGameState(prev => ({ ...prev, chatHistory: newHistory }));
        await processAITurn(message, newHistory);
        
        setGameState(prev => {
            if (!prev.battle || prev.awaitingRoll) return prev;
            const nextIndex = (prev.battle.currentTurnIndex + 1) % prev.battle.turnOrder.length;
            return { ...prev, battle: { ...prev.battle, currentTurnIndex: nextIndex }};
        });
    };
    
     const handleGenerateImage = useCallback(async (key: string, prompt: string) => {
        if (gameState.isGeneratingImage) return;
        setGameState(prev => ({ ...prev, isGeneratingImage: true }));
        try {
            const base64Url = await generateImage(prompt);
            const newImagesCache = { ...gameState.imagesCache, [key]: base64Url };
            setGameState(prev => ({
                ...prev,
                imagesCache: newImagesCache,
                isGeneratingImage: false,
            }));
             localStorage.setItem('ai-game-master-images', JSON.stringify(newImagesCache));
        } catch (error) {
            console.error("Failed to generate image:", error);
            alert("Sorry, the visualizer failed to conjure an image. The spirits may be weak.");
            setGameState(prev => ({ ...prev, isGeneratingImage: false }));
        }
    }, [gameState.isGeneratingImage, gameState.imagesCache]);


    const handleInitiativeRoll = async (playerRoll: number) => {
        if (!gameState.battle || !gameState.character) return;
        
        const initiatives: { id: string; roll: number }[] = [];
        initiatives.push({ id: 'player', roll: playerRoll });
        
        const battleWithInitiatives = { ...gameState.battle };
        battleWithInitiatives.enemies = gameState.battle.enemies.map(enemy => {
            const roll = Math.floor(Math.random() * 20) + 1 + enemy.initiativeBonus;
            initiatives.push({ id: enemy.id, roll });
            return { ...enemy, initiative: roll };
        });
        
        initiatives.sort((a, b) => b.roll - a.roll);
        const turnOrder = initiatives.map(i => i.id);
        
        const finalBattleState = { ...battleWithInitiatives, turnOrder, currentTurnIndex: 0 };
        
        const playerRollText = `(Rolled a d20 for Initiative: ${playerRoll})`;
        const newHistory = [...gameState.chatHistory, { sender: 'player' as const, text: playerRollText }];
        
        setGameState(prev => ({ ...prev, battle: finalBattleState, awaitingRoll: null, chatHistory: newHistory }));
    };

    const handleRollResult = async (total: number, d20Roll: number, modifier: number) => {
        if (!gameState.awaitingRoll || !gameState.character) return;
        
        if (gameState.awaitingRoll.type === RollType.INITIATIVE) {
            await handleInitiativeRoll(total);
            return;
        }
    
        const { ability, type, dc } = gameState.awaitingRoll;
        const typeText = type.replace('_', ' ').toLowerCase();
        
        const playerRollText = `(Rolled a d20 for ${ability} ${typeText}: ${d20Roll} ${modifier >= 0 ? `+${modifier}`: modifier} = ${total})`;
        const newHistory = [...gameState.chatHistory, { sender: 'player' as const, text: playerRollText }];
        
        setGameState(prev => ({ ...prev, chatHistory: newHistory, awaitingRoll: null }));
        
        const aiPrompt = `My character rolled a total of ${total} for their ${ability} ${typeText} against a DC of ${dc}. Describe what happens now.`;
        
        await processAITurn(aiPrompt, newHistory);
    };
    
    const handleLevelUpComplete = async (choices: { spells?: Spell[], archetype?: Archetype }) => {
        if (!gameState.character || !gameState.awaitingLevelUpChoices) return;
    
        let updatedCharacter: Character = { ...gameState.character };
        const logMessages: string[] = [];
        const isGameStart = gameState.chatHistory.length === 0;
    
        // Add new spells
        if (choices.spells && choices.spells.length > 0) {
            const newSpells = [...updatedCharacter.spells, ...choices.spells];
            updatedCharacter.spells = newSpells;
            logMessages.push(`Learned: ${choices.spells.map(s => s.name).join(', ')}.`);
        }
    
        // Add archetype and its features
        if (choices.archetype) {
            updatedCharacter.archetype = choices.archetype;
            // Archetype features are granted at level 3 in our current data
            const featuresForLevel = choices.archetype.features[3];
            if (featuresForLevel) {
                updatedCharacter.features = [...updatedCharacter.features, ...featuresForLevel];
                logMessages.push(`Gained new features: ${featuresForLevel.map(f => f.name).join(', ')}.`);
            }
            logMessages.unshift(`Chosen archetype: ${choices.archetype.name}.`);
        }
    
        const logPrefix = isGameStart ? 'Character configured for' : 'Character updated for';
        const fullLogMessage = `${logPrefix} Level ${gameState.awaitingLevelUpChoices.level}. ${logMessages.join(' ')}`;
        const newHistory = [...gameState.chatHistory, { sender: 'system' as const, text: fullLogMessage }];
        
        if (isGameStart) {
            // This is the initial game start after archetype selection.
            // Set state and then trigger the first AI turn.
            setGameState(prev => ({
                ...prev,
                character: updatedCharacter,
                awaitingLevelUpChoices: null,
                chatHistory: newHistory,
                isLoading: true,
            }));
            await processAITurn("My adventure begins. Describe my starting location and situation.", newHistory, updatedCharacter);
        } else {
            // This is a normal in-game level up.
            setGameState(prev => ({
                ...prev,
                character: updatedCharacter,
                awaitingLevelUpChoices: null,
                chatHistory: newHistory
            }));
        }
    };

    const handleNewGame = () => {
        setGameState(prev => ({
            ...prev,
            character: null,
            chatHistory: [],
            screen: Screen.Setup,
            isLoading: false,
            awaitingRoll: null,
            awaitingLevelUpChoices: null,
            gameId: prev.gameId + 1,
            setting: null,
            battle: null,
            imagesCache: {},
            imagePrompts: {},
            currentImageKey: null,
            isGeneratingImage: false,
        }));
        localStorage.removeItem('ai-game-master-save');
        localStorage.removeItem('ai-game-master-images');
        setSaveFileExists(false);
    };

    const handleGoToMenu = () => {
        setShowExitConfirm(true);
    };

    const handleConfirmExit = () => {
        setGameState(prev => ({
            ...prev,
            character: null,
            chatHistory: [],
            screen: Screen.Menu,
            isLoading: false,
            awaitingRoll: null,
            setting: null,
            battle: null,
        }));
        setShowExitConfirm(false);
    };

    const handleSaveSettings = (newTemperature: number) => {
        setGameState(prev => ({
            ...prev,
            temperature: newTemperature,
            screen: Screen.Menu,
        }));
        localStorage.setItem('ai-game-master-settings', JSON.stringify({ temperature: newTemperature }));
    };

    const renderScreen = () => {
        switch (gameState.screen) {
            case Screen.Menu:
                return <MainMenuScreen 
                    onNewGame={handleNewGame} 
                    onLoadGame={handleLoadGame} 
                    onSettings={() => setGameState(p => ({ ...p, screen: Screen.Settings }))}
                    canLoad={saveFileExists}
                    apiKeyConfigured={hasGeminiApiKey()}
                />;
            case Screen.Settings:
                return <SettingsScreen 
                    currentTemperature={gameState.temperature}
                    onSave={handleSaveSettings}
                    onBack={() => setGameState(p => ({ ...p, screen: Screen.Menu }))}
                />;
            case Screen.Setup:
                return <AdventureSetupScreen 
                    onSetupComplete={handleSetupComplete} 
                    onBack={() => setGameState(p => ({ ...p, screen: Screen.Menu }))}
                />;
            case Screen.Creation:
                return <CharacterCreationScreen key={gameState.gameId} onStartGame={handleStartGame} />;
            case Screen.Game:
                if (!gameState.character) return null;
                return (
                    <GameScreen
                        character={gameState.character}
                        chatHistory={gameState.chatHistory}
                        onSendMessage={handleSendMessage}
                        isLoading={gameState.isLoading}
                        onSaveGame={handleSaveGame}
                        onLoadGame={handleLoadGame}
                        onGoToMenu={handleGoToMenu}
                        awaitingRoll={gameState.awaitingRoll}
                        onRollResult={handleRollResult}
                        battle={gameState.battle}
                        // Image props
                        imagesCache={gameState.imagesCache}
                        imagePrompts={gameState.imagePrompts}
                        currentImageKey={gameState.currentImageKey}
                        isGeneratingImage={gameState.isGeneratingImage}
                        onGenerateImage={handleGenerateImage}
                    />
                );
            default:
                return <div>Error: Unknown screen</div>;
        }
    };

    if (gameState.awaitingLevelUpChoices && gameState.character) {
        return (
            <LevelUpScreen
                character={gameState.character}
                levelUpChoices={gameState.awaitingLevelUpChoices}
                onComplete={handleLevelUpComplete}
            />
        );
    }

    return (
        <div className="h-screen w-screen bg-gray-900 font-sans">
            {renderScreen()}
            <ConfirmationDialog 
                isOpen={showExitConfirm}
                onConfirm={handleConfirmExit}
                onCancel={() => setShowExitConfirm(false)}
                title="Exit to Main Menu?"
                message="Are you sure? Any unsaved progress will be lost."
            />
        </div>
    );
};

export default App;