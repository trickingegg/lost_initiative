import React, { useState } from 'react';
import type { GameSession, GMResponse } from '../sessionApi/types';
import CharacterSheet from './CharacterSheet';
import StoryLog from './StoryLog';
import DiceRollPrompt from './DiceRollPrompt';
import BattleTracker from './BattleTracker';

interface GameScreenProps {
    session: GameSession;
    lastGm: GMResponse | null;
    isLoading: boolean;
    error: string | null;
    statusMessage: string | null;
    onSendMessage: (message: string) => void;
    onRoll: (total: number) => void;
    onRest: () => void;
    onSave: (slot: number) => void;
    onLoad: (slot: number) => void;
    onGoToMenu: () => void;
}

const GameScreen: React.FC<GameScreenProps> = ({
    session, lastGm, isLoading, error, statusMessage,
    onSendMessage, onRoll, onRest, onSave, onLoad, onGoToMenu,
}) => {
    const [input, setInput] = useState('');
    const [slot, setSlot] = useState(1);
    const awaitingRoll = lastGm?.state_changes.await_roll ?? null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading && !awaitingRoll) {
            onSendMessage(input.trim());
            setInput('');
        }
    };

    return (
        <div className="h-screen w-screen flex flex-col md:flex-row bg-gray-800 text-gray-200">
            <main className="flex-1 flex flex-col h-full p-4 overflow-hidden">
                <div className="flex-shrink-0 mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h1 className="text-2xl font-bold text-yellow-400">AI Game Master</h1>
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={slot}
                            onChange={(e) => setSlot(parseInt(e.target.value, 10))}
                            disabled={isLoading}
                            className="bg-gray-700 border border-gray-600 text-sm rounded py-2 px-2"
                            aria-label="Save slot"
                        >
                            <option value={1}>Slot 1</option>
                            <option value={2}>Slot 2</option>
                            <option value={3}>Slot 3</option>
                        </select>
                        <button
                            onClick={() => onSave(slot)}
                            disabled={isLoading}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 px-3 rounded disabled:bg-gray-500"
                        >
                            Save
                        </button>
                        <button
                            onClick={() => onLoad(slot)}
                            disabled={isLoading}
                            className="bg-gray-600 hover:bg-gray-700 text-white text-sm font-bold py-2 px-3 rounded disabled:bg-gray-500"
                        >
                            Load
                        </button>
                        <button
                            onClick={onRest}
                            disabled={isLoading || !!awaitingRoll}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold py-2 px-3 rounded disabled:bg-gray-500"
                        >
                            Long Rest
                        </button>
                        <button
                            onClick={onGoToMenu}
                            disabled={isLoading}
                            className="bg-gray-600 hover:bg-gray-700 text-white text-sm font-bold py-2 px-3 rounded disabled:bg-gray-500"
                        >
                            Menu
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mb-3 bg-red-900/50 border border-red-500 text-red-100 text-sm rounded px-3 py-2">{error}</div>
                )}
                {statusMessage && (
                    <div className="mb-3 bg-blue-900/40 border border-blue-500 text-blue-100 text-sm rounded px-3 py-2">{statusMessage}</div>
                )}
                {session.pending_level_up && (
                    <div className="mb-3 bg-yellow-900/40 border border-yellow-500 text-yellow-100 text-sm rounded px-3 py-2">
                        You reached level {session.pending_level_up.new_level}
                        {' '}(+{session.pending_level_up.hp_increase} HP). Subclass choices come in a later update.
                    </div>
                )}

                {session.battle_state && <BattleTracker battle={session.battle_state} />}
                <StoryLog chatHistory={session.chat_history} />

                <div className="mt-4">
                    {awaitingRoll ? (
                        <DiceRollPrompt
                            character={session.character}
                            awaitingRoll={awaitingRoll}
                            onRoll={onRoll}
                            isLoading={isLoading}
                        />
                    ) : (
                        <>
                            <form onSubmit={handleSubmit} className="flex items-center">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="What do you do?"
                                    className="flex-grow bg-gray-700 border border-gray-600 rounded-l-md shadow-sm py-2 px-4 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                                    disabled={isLoading}
                                />
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-2 px-4 rounded-r-md transition duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed h-[42px] w-[80px] flex items-center justify-center"
                                >
                                    {isLoading ? (
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
                                    ) : (
                                        'Send'
                                    )}
                                </button>
                            </form>
                            {lastGm && lastGm.suggested_actions.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {lastGm.suggested_actions.map((action) => (
                                        <button
                                            key={action}
                                            type="button"
                                            disabled={isLoading}
                                            onClick={() => onSendMessage(action)}
                                            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1 rounded-full disabled:opacity-50"
                                        >
                                            {action}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>

            <aside className="w-full md:w-80 lg:w-96 bg-gray-900 p-4 overflow-y-auto h-full flex-shrink-0 border-l-2 border-gray-700">
                <CharacterSheet character={session.character} />
            </aside>
        </div>
    );
};

export default GameScreen;
