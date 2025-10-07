import React, { useState } from 'react';
import { Character, ChatMessage, AwaitingRollState, BattleState } from '../types';
import CharacterSheet from './CharacterSheet';
import StoryLog from './StoryLog';
import DiceRollPrompt from './DiceRollPrompt';
import BattleTracker from './BattleTracker';

interface GameScreenProps {
    character: Character;
    chatHistory: ChatMessage[];
    onSendMessage: (message: string) => void;
    isLoading: boolean;
    onSaveGame: () => void;
    onLoadGame: () => void;
    onGoToMenu: () => void;
    awaitingRoll: AwaitingRollState | null;
    onRollResult: (total: number, d20Roll: number, modifier: number) => void;
    battle: BattleState | null;
}

const GameScreen: React.FC<GameScreenProps> = ({ character, chatHistory, onSendMessage, isLoading, onSaveGame, onLoadGame, onGoToMenu, awaitingRoll, onRollResult, battle }) => {
    const [input, setInput] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading && !awaitingRoll) {
            onSendMessage(input.trim());
            setInput('');
        }
    };
    
    const isPlayerTurn = battle ? battle.turnOrder[battle.currentTurnIndex] === 'player' : true;

    return (
        <div className="h-screen w-screen flex flex-col md:flex-row bg-gray-800 text-gray-200">
            {/* Main Content: Story & Input */}
            <main className="flex-1 flex flex-col h-full p-4 overflow-hidden">
                <div className="flex-shrink-0 mb-4 flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-yellow-400">AI Game Master</h1>
                    <div className="flex space-x-2">
                        <button 
                            onClick={onSaveGame} 
                            disabled={isLoading}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 px-3 rounded transition duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed"
                        >
                            Save
                        </button>
                        <button 
                            onClick={onLoadGame} 
                            disabled={isLoading}
                            className="bg-gray-600 hover:bg-gray-700 text-white text-sm font-bold py-2 px-3 rounded transition duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed"
                        >
                            Load
                        </button>
                        <button 
                            onClick={onGoToMenu} 
                            disabled={isLoading}
                            className="bg-gray-600 hover:bg-gray-700 text-white text-sm font-bold py-2 px-3 rounded transition duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed"
                        >
                            Menu
                        </button>
                    </div>
                </div>
                
                {battle && <BattleTracker battle={battle} />}
                <StoryLog chatHistory={chatHistory} />
                
                <div className="mt-4">
                    {awaitingRoll ? (
                        <DiceRollPrompt
                            character={character}
                            awaitingRoll={awaitingRoll}
                            onRoll={onRollResult}
                            isLoading={isLoading}
                        />
                    ) : (
                        <form onSubmit={handleSubmit} className="flex items-center">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={battle ? (isPlayerTurn ? "Your turn. What do you do?" : "Waiting for opponent...") : "What do you do?"}
                                className="flex-grow bg-gray-700 border border-gray-600 rounded-l-md shadow-sm py-2 px-4 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                                disabled={isLoading || (battle && !isPlayerTurn)}
                            />
                            <button
                                type="submit"
                                disabled={isLoading || (battle && !isPlayerTurn)}
                                className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-2 px-4 rounded-r-md transition duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed h-[42px] w-[80px] flex items-center justify-center"
                            >
                                {isLoading ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
                                ) : (
                                    'Send'
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </main>

            {/* Sidebar: Character Sheet */}
            <aside className="w-full md:w-80 lg:w-96 bg-gray-900 p-4 overflow-y-auto h-full flex-shrink-0 border-l-2 border-gray-700">
                <CharacterSheet character={character} />
            </aside>
        </div>
    );
};

export default GameScreen;