import React, { useState, useEffect } from 'react';
import { Character, GameState, Screen, AwaitingRollState, RollType, Ability } from './types';
import CharacterCreationScreen from './components/CharacterCreationScreen';
import GameScreen from './components/GameScreen';
import AdventureSetupScreen from './components/AdventureSetupScreen';
import MainMenuScreen from './components/MainMenuScreen';
import SettingsScreen from './components/SettingsScreen';
import ConfirmationDialog from './components/ConfirmationDialog';
import { getGameMasterResponse } from './services/geminiService';
import { processCommands } from './utils/commandProcessor';

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
        };
    });
    
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [saveFileExists, setSaveFileExists] = useState(false);

    useEffect(() => {
        const savedGame = localStorage.getItem('ai-game-master-save');
        setSaveFileExists(!!savedGame);
    }, []);

    const handleSaveGame = () => {
        if (gameState.character && gameState.setting) {
            try {
                const stateToSave = {
                    character: gameState.character,
                    chatHistory: gameState.chatHistory,
                    setting: gameState.setting,
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
        }));
        
        await processAITurn("My adventure begins. Describe my starting location and situation.", [], character);
    };

    const processAITurn = async (promptForAI: string, currentHistory: GameState['chatHistory'], characterOverride?: Character) => {
        const character = characterOverride || gameState.character;
        if (!character || !gameState.setting) return;
    
        setGameState(prev => ({ ...prev, isLoading: true, awaitingRoll: null }));
    
        try {
            const { narrative, commands } = await getGameMasterResponse(promptForAI, character, currentHistory, gameState.setting, gameState.temperature);
    
            const awaitRollCommand = commands.find(c => c.startsWith('[AWAIT_ROLL:'));
            const otherCommands = commands.filter(c => !c.startsWith('[AWAIT_ROLL:'));
    
            const characterAfterCommands = processCommands(character, otherCommands);
            
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
    };

    const handleSendMessage = async (message: string) => {
        if (gameState.isLoading || gameState.awaitingRoll) return;
        const newHistory = [...gameState.chatHistory, { sender: 'player' as const, text: message }];
        setGameState(prev => ({ ...prev, chatHistory: newHistory }));
        await processAITurn(message, newHistory);
    };

    const handleRollResult = async (total: number, d20Roll: number, modifier: number) => {
        if (!gameState.awaitingRoll || !gameState.character) return;
    
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