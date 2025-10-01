import React, { useState, useCallback, useEffect } from 'react';
import { Character, GameState, Screen, AwaitingRollState, RollType, Ability } from './types';
import CharacterCreationScreen from './components/CharacterCreationScreen';
import GameScreen from './components/GameScreen';
import { getGameMasterResponse } from './services/geminiService';
import { processCommands } from './utils/commandProcessor';
import { INITIAL_CHARACTER } from './constants';

const App: React.FC = () => {
    const [gameState, setGameState] = useState<GameState>({
        character: null,
        chatHistory: [],
        screen: Screen.Creation,
        isLoading: false,
        awaitingRoll: null,
    });

    const handleSaveGame = useCallback(() => {
        if (gameState.character) {
            try {
                const stateToSave = {
                    character: gameState.character,
                    chatHistory: gameState.chatHistory,
                };
                localStorage.setItem('ai-game-master-save', JSON.stringify(stateToSave));
                alert('Game saved!');
            } catch (error) {
                console.error('Failed to save game:', error);
                alert('Error: Could not save game.');
            }
        }
    }, [gameState.character, gameState.chatHistory]);

    const handleLoadGame = useCallback(() => {
        try {
            const savedStateJSON = localStorage.getItem('ai-game-master-save');
            if (savedStateJSON) {
                const savedState = JSON.parse(savedStateJSON);
                setGameState({
                    character: savedState.character,
                    chatHistory: savedState.chatHistory,
                    screen: Screen.Game,
                    isLoading: false,
                    awaitingRoll: null,
                });
            } else {
                alert('No saved game found.');
            }
        } catch (error) {
            console.error('Failed to load game:', error);
            alert('Error: Could not load game.');
        }
    }, []);

    const handleStartGame = useCallback((character: Character) => {
        setGameState({
            character,
            chatHistory: [{ sender: 'gm', text: 'Your adventure begins! You find yourself standing at a crossroads. What do you do?' }],
            screen: Screen.Game,
            isLoading: false,
            awaitingRoll: null,
        });
    }, []);

    const processAITurn = useCallback(async (promptForAI: string, currentHistory: GameState['chatHistory']) => {
        if (!gameState.character) return;
    
        setGameState(prev => ({ ...prev, isLoading: true, awaitingRoll: null }));
    
        try {
            const { narrative, commands } = await getGameMasterResponse(promptForAI, gameState.character, currentHistory);
    
            const awaitRollCommand = commands.find(c => c.startsWith('[AWAIT_ROLL:'));
            const otherCommands = commands.filter(c => !c.startsWith('[AWAIT_ROLL:'));
    
            // Apply state changes from commands first
            const characterAfterCommands = processCommands(gameState.character, otherCommands);
            
            let newAwaitingRollState: AwaitingRollState | null = null;
            if (awaitRollCommand) {
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
    
            const finalHistory = narrative ? [...currentHistory, { sender: 'gm' as const, text: narrative }] : currentHistory;

            setGameState(prev => ({ 
                ...prev, 
                character: characterAfterCommands, 
                chatHistory: finalHistory, 
                isLoading: false,
                awaitingRoll: newAwaitingRollState
            }));
        } catch (error) {
            console.error('Error getting response from AI:', error);
            const errorHistory = [...currentHistory, { sender: 'gm' as const, text: 'The ancient magics are failing... (An error occurred). Please try again.' }];
            setGameState(prev => ({ ...prev, chatHistory: errorHistory, isLoading: false }));
        }
    }, [gameState.character]);

    const handleSendMessage = useCallback(async (message: string) => {
        if (gameState.isLoading || gameState.awaitingRoll) return;
        const newHistory = [...gameState.chatHistory, { sender: 'player' as const, text: message }];
        setGameState(prev => ({ ...prev, chatHistory: newHistory }));
        await processAITurn(message, newHistory);
    }, [gameState.isLoading, gameState.awaitingRoll, gameState.chatHistory, processAITurn]);

    const handleRollResult = useCallback(async (total: number, d20Roll: number, modifier: number) => {
        if (!gameState.awaitingRoll || !gameState.character) return;
    
        const { ability, type, dc } = gameState.awaitingRoll;
        const typeText = type.replace('_', ' ').toLowerCase();
        
        const playerRollText = `(Rolled a d20 for ${ability} ${typeText}: ${d20Roll} ${modifier >= 0 ? `+${modifier}`: modifier} = ${total})`;
        const newHistory = [...gameState.chatHistory, { sender: 'player' as const, text: playerRollText }];
        
        // Immediately update chat history and clear roll state
        setGameState(prev => ({ ...prev, chatHistory: newHistory, awaitingRoll: null }));
        
        const aiPrompt = `My character rolled a total of ${total} for their ${ability} ${typeText} against a DC of ${dc}. Describe what happens now.`;
        
        await processAITurn(aiPrompt, newHistory);
    }, [gameState.awaitingRoll, gameState.chatHistory, gameState.character, processAITurn]);
    
    const handleNewGame = useCallback(() => {
        if(window.confirm('Are you sure you want to start a new game? Any unsaved progress will be lost.')) {
            setGameState({
                character: null,
                chatHistory: [],
                screen: Screen.Creation,
                isLoading: false,
                awaitingRoll: null,
            });
            localStorage.removeItem('ai-game-master-save');
        }
    }, []);

    useEffect(() => {
        // Automatically try to load a game on startup
        // handleLoadGame(); We don't call this to allow new game creation
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    const renderScreen = () => {
        switch (gameState.screen) {
            case Screen.Creation:
                return <CharacterCreationScreen onStartGame={handleStartGame} onNewGame={handleNewGame} onLoadGame={handleLoadGame} />;
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
                        onNewGame={handleNewGame}
                        awaitingRoll={gameState.awaitingRoll}
                        onRollResult={handleRollResult}
                    />
                );
            default:
                return <div>Error: Unknown screen</div>;
        }
    };

    return <div className="h-screen w-screen bg-gray-900 font-sans">{renderScreen()}</div>;
};

export default App;