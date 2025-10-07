import React, { useState, useEffect, useCallback } from 'react';
import { Character, GameState, Screen, AwaitingRollState, RollType, Ability, BattleState } from './types';
import CharacterCreationScreen from './components/CharacterCreationScreen';
import GameScreen from './components/GameScreen';
import AdventureSetupScreen from './components/AdventureSetupScreen';
import MainMenuScreen from './components/MainMenuScreen';
import SettingsScreen from './components/SettingsScreen';
import ConfirmationDialog from './components/ConfirmationDialog';
import { getGameMasterResponse } from './services/geminiService';
import { processCharacterCommands } from './utils/commandProcessor';

const App: React.FC = () => {
    const [gameState, setGameState] = useState<GameState>(() => {
        const savedSettings = localStorage.getItem('ai-game-master-settings');
        const settings = savedSettings ? JSON.parse(savedSettings) : { temperature: 0.9 };
        return {
            character: null,
            chatHistory: [],
            screen: Screen.Menu,
            isLoading: false,
            awaitingRoll: null,
            gameId: 0,
            setting: null,
            temperature: settings.temperature,
            battle: null,
        };
    });
    
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [saveFileExists, setSaveFileExists] = useState(false);

    useEffect(() => {
        const savedGame = localStorage.getItem('ai-game-master-save');
        setSaveFileExists(!!savedGame);
    }, []);

    // Effect to handle enemy turns in battle
    useEffect(() => {
        const { battle, isLoading, awaitingRoll, character, chatHistory } = gameState;
        if (battle && battle.turnOrder.length > 0 && !isLoading && !awaitingRoll && character) {
            const currentTurnId = battle.turnOrder[battle.currentTurnIndex];
            if (currentTurnId !== 'player') {
                const enemy = battle.enemies.find(e => e.id === currentTurnId);
                if (enemy) {
                    const aiPrompt = `It is now ${enemy.name}'s turn. What do they do?`;
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
                };
                localStorage.setItem('ai-game-master-save', JSON.stringify(stateToSave));
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
                setGameState(prev => ({
                    ...prev,
                    character: savedState.character,
                    chatHistory: savedState.chatHistory,
                    setting: savedState.setting,
                    battle: savedState.battle,
                    screen: Screen.Game,
                    isLoading: false,
                    awaitingRoll: null,
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
        setGameState(prev => ({
            ...prev,
            character,
            chatHistory: [],
            screen: Screen.Game,
            isLoading: true,
            awaitingRoll: null,
            battle: null,
        }));
        
        await processAITurn("My adventure begins. Describe my starting location and situation.", [], character);
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
    
            const characterCommands = commands.filter(c => !c.startsWith('[START_BATTLE:') && !c.startsWith('[END_BATTLE:') && !c.startsWith('[ENEMY_DAMAGE:') && !c.startsWith('[AWAIT_ROLL:'));
            const battleCommands = commands.filter(c => c.startsWith('[START_BATTLE:') || c.startsWith('[END_BATTLE:') || c.startsWith('[ENEMY_DAMAGE:'));
            const awaitRollCommand = commands.find(c => c.startsWith('[AWAIT_ROLL:'));
    
            const characterAfterCommands = processCharacterCommands(character, characterCommands);
            
            let newAwaitingRollState: AwaitingRollState | null = null;
            let newBattleState: BattleState | null = gameState.battle ? { ...gameState.battle } : null;

            // Process Battle Commands
            for (const command of battleCommands) {
                if (command.startsWith('[START_BATTLE:')) {
                    const jsonString = command.substring('[START_BATTLE:'.length, command.length - 1);
                    try {
                        // Sanitize the JSON string from common AI errors.
                        let sanitizedJsonString = jsonString.replace(/,\s*([\]}])/g, '$1'); // 1. Remove trailing commas.

                        // 2. Handle cases where the AI forgets the closing bracket for the array.
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
                }
            }
             
             if (newBattleState && newBattleState.enemies.length === 0) {
                 newBattleState = null;
             }


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

            // If it was an enemy's turn in battle, advance the turn counter.
            if (newBattleState && newBattleState.turnOrder.length > 0) {
                const currentTurnId = newBattleState.turnOrder[newBattleState.currentTurnIndex];
                if(currentTurnId !== 'player' && !newAwaitingRollState) {
                    newBattleState.currentTurnIndex = (newBattleState.currentTurnIndex + 1) % newBattleState.turnOrder.length;
                }
            }
    
            const finalHistory = narrative ? [...currentHistory, { sender: 'gm' as const, text: narrative }] : currentHistory;

            setGameState(prev => ({ 
                ...prev, 
                character: characterAfterCommands, 
                chatHistory: finalHistory, 
                isLoading: false,
                awaitingRoll: newAwaitingRollState,
                battle: newBattleState
            }));
        } catch (error) {
            console.error('Error getting response from AI:', error);
            const errorHistory = [...currentHistory, { sender: 'gm' as const, text: 'The ancient magics are failing... (An error occurred). Please try again.' }];
            setGameState(prev => ({ ...prev, chatHistory: errorHistory, isLoading: false }));
        }
    }, [gameState.character, gameState.setting, gameState.temperature, gameState.battle]);

    const handleSendMessage = async (message: string) => {
        if (gameState.isLoading || gameState.awaitingRoll) return;
        const newHistory = [...gameState.chatHistory, { sender: 'player' as const, text: message }];
        setGameState(prev => ({ ...prev, chatHistory: newHistory }));
        await processAITurn(message, newHistory);
        
        // After player action, if in battle, end turn.
        setGameState(prev => {
            if (!prev.battle || prev.awaitingRoll) return prev;
            const nextIndex = (prev.battle.currentTurnIndex + 1) % prev.battle.turnOrder.length;
            return { ...prev, battle: { ...prev.battle, currentTurnIndex: nextIndex }};
        });
    };

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
    
    const handleNewGame = () => {
        setGameState(prev => ({
            ...prev,
            character: null,
            chatHistory: [],
            screen: Screen.Setup,
            isLoading: false,
            awaitingRoll: null,
            gameId: prev.gameId + 1,
            setting: null,
            battle: null,
        }));
        localStorage.removeItem('ai-game-master-save');
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
                    />
                );
            default:
                return <div>Error: Unknown screen</div>;
        }
    };

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