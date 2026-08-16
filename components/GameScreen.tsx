import React, { useState } from 'react';
import type { GameSession, GMResponse, SaveSlotInfo } from '../sessionApi/types';
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
    saveSlots: SaveSlotInfo[];
    canRetry: boolean;
    onSendMessage: (message: string) => void;
    onRoll: (total: number, natural: number) => void;
    onRest: (kind: 'short' | 'long') => void;
    onSave: (slot: number) => void;
    onLoad: (slot: number) => void;
    onRetry: () => void;
    onGoToMenu: () => void;
}

function slotLabel(info: SaveSlotInfo | undefined, slot: number): string {
    if (!info) {
        return `Slot ${slot} (empty)`;
    }
    const when = info.saved_at ? new Date(info.saved_at).toLocaleString() : 'saved';
    return `Slot ${slot}: ${info.character_name} · turn ${info.turn_count} · ${when}`;
}

const GameScreen: React.FC<GameScreenProps> = ({
    session, lastGm, isLoading, error, statusMessage, saveSlots, canRetry,
    onSendMessage, onRoll, onRest, onSave, onLoad, onRetry, onGoToMenu,
}) => {
    const [input, setInput] = useState('');
    const [slot, setSlot] = useState(1);
    const [confirmSlot, setConfirmSlot] = useState<number | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const awaitingRoll = lastGm?.state_changes.await_roll ?? null;
    const occupied = saveSlots.find((item) => item.slot === slot);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading && !awaitingRoll) {
            onSendMessage(input.trim());
            setInput('');
        }
    };

    const handleSaveClick = () => {
        if (occupied && confirmSlot !== slot) {
            setConfirmSlot(slot);
            return;
        }
        setConfirmSlot(null);
        onSave(slot);
    };

    return (
        <div className="h-[100dvh] w-screen flex flex-col md:flex-row bg-gray-800 text-gray-200">
            <main className="flex-1 flex flex-col min-h-0 p-4 overflow-hidden">
                <div className="flex-shrink-0 mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h1 className="text-2xl font-bold text-yellow-400">AI Game Master</h1>
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={slot}
                            onChange={(e) => {
                                setSlot(parseInt(e.target.value, 10));
                                setConfirmSlot(null);
                            }}
                            disabled={isLoading}
                            className="bg-gray-700 border border-gray-600 text-sm rounded py-2 px-2 max-w-[220px]"
                            aria-label="Save slot"
                        >
                            {[1, 2, 3].map((value) => {
                                const info = saveSlots.find((item) => item.slot === value);
                                return (
                                    <option key={value} value={value}>
                                        {slotLabel(info, value)}
                                    </option>
                                );
                            })}
                        </select>
                        <button
                            onClick={handleSaveClick}
                            disabled={isLoading}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 px-3 rounded disabled:bg-gray-500"
                        >
                            {confirmSlot === slot ? 'Confirm overwrite' : 'Save'}
                        </button>
                        <button
                            onClick={() => onLoad(slot)}
                            disabled={isLoading || !occupied}
                            className="bg-gray-600 hover:bg-gray-700 text-white text-sm font-bold py-2 px-3 rounded disabled:bg-gray-500"
                        >
                            Load
                        </button>
                        <button
                            onClick={() => onRest('short')}
                            disabled={isLoading || !!awaitingRoll}
                            className="bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-bold py-2 px-3 rounded disabled:bg-gray-500"
                        >
                            Short Rest
                        </button>
                        <button
                            onClick={() => onRest('long')}
                            disabled={isLoading || !!awaitingRoll}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold py-2 px-3 rounded disabled:bg-gray-500"
                        >
                            Long Rest
                        </button>
                        <button
                            onClick={() => setSheetOpen((open) => !open)}
                            className="md:hidden bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold py-2 px-3 rounded"
                        >
                            {sheetOpen ? 'Hide sheet' : 'Sheet'}
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
                    <div className="mb-3 bg-red-900/50 border border-red-500 text-red-100 text-sm rounded px-3 py-2 flex items-center justify-between gap-2">
                        <span>{error}</span>
                        {canRetry && (
                            <button
                                type="button"
                                onClick={onRetry}
                                disabled={isLoading}
                                className="shrink-0 bg-red-700 hover:bg-red-600 text-white text-xs font-bold py-1 px-3 rounded"
                            >
                                Retry
                            </button>
                        )}
                    </div>
                )}
                {statusMessage && (
                    <div className="mb-3 bg-blue-900/40 border border-blue-500 text-blue-100 text-sm rounded px-3 py-2">{statusMessage}</div>
                )}
                {confirmSlot === slot && occupied && (
                    <div className="mb-3 bg-amber-900/40 border border-amber-500 text-amber-100 text-sm rounded px-3 py-2">
                        Slot {slot} already has {occupied.character_name} (turn {occupied.turn_count}). Click Confirm overwrite to replace it.
                    </div>
                )}
                {session.pending_level_up && (
                    <div className="mb-3 bg-yellow-900/40 border border-yellow-500 text-yellow-100 text-sm rounded px-3 py-2">
                        You reached level {session.pending_level_up.new_level}
                        {' '}(+{session.pending_level_up.hp_increase} HP). Subclass choices come in a later update.
                    </div>
                )}
                {canRetry && !error && (
                    <div className="mb-3 bg-amber-900/40 border border-amber-600 text-amber-100 text-sm rounded px-3 py-2 flex items-center justify-between gap-2">
                        <span>The Game Master lost focus. You can retry the last action.</span>
                        <button
                            type="button"
                            onClick={onRetry}
                            disabled={isLoading}
                            className="shrink-0 bg-yellow-600 hover:bg-yellow-500 text-gray-900 text-xs font-bold py-1 px-3 rounded"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {session.battle_state && <BattleTracker battle={session.battle_state} />}
                <StoryLog chatHistory={session.chat_history} isThinking={isLoading} />

                <div className="mt-4 flex-shrink-0">
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

            <aside className={`${sheetOpen ? 'flex' : 'hidden'} md:flex w-full md:w-80 lg:w-96 bg-gray-900 p-4 overflow-y-auto md:h-full flex-shrink-0 border-t-2 md:border-t-0 md:border-l-2 border-gray-700 max-h-[45vh] md:max-h-none`}>
                <CharacterSheet character={session.character} />
            </aside>
        </div>
    );
};

export default GameScreen;
