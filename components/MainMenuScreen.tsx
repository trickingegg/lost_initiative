import React from 'react';

interface MainMenuScreenProps {
    onNewGame: () => void;
    onLoadSlot: (slot: number) => void;
    onSettings: () => void;
    canLoad: boolean;
    backendOk: boolean | null;
    error?: string | null;
}

const MainMenuScreen: React.FC<MainMenuScreenProps> = ({
    onNewGame, onLoadSlot, onSettings, canLoad, backendOk, error,
}) => {
    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-md text-center">
                <h1 className="text-6xl font-bold text-yellow-400 mb-2" style={{ fontFamily: 'serif', letterSpacing: '0.1em' }}>
                    AI Game Master
                </h1>
                <p className="text-gray-400 mb-12">Your adventure awaits.</p>

                <div className="space-y-4">
                    <button
                        onClick={onNewGame}
                        disabled={backendOk === false}
                        className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-4 px-6 rounded-md transition duration-200 text-xl disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                        New Game
                    </button>
                    <div>
                        <p className="text-sm text-gray-500 mb-2">Load Game</p>
                        <div className="grid grid-cols-3 gap-2">
                            {[1, 2, 3].map((slot) => (
                                <button
                                    key={slot}
                                    onClick={() => onLoadSlot(slot)}
                                    disabled={!canLoad}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-2 rounded-md transition duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed"
                                >
                                    Slot {slot}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button
                        onClick={onSettings}
                        className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-md transition duration-200 text-xl"
                    >
                        Settings
                    </button>
                </div>

                {error && (
                    <p className="mt-8 text-sm text-red-300">{error}</p>
                )}
                {backendOk === false && (
                    <p className="mt-8 text-sm text-amber-400">
                        Game server is not reachable. Start the FastAPI backend on port 8000, then reload.
                    </p>
                )}
                {backendOk === true && !canLoad && !error && (
                    <p className="mt-8 text-sm text-gray-500">
                        No saved session on this browser yet. Start a new game, then use Save.
                    </p>
                )}
            </div>
        </div>
    );
};

export default MainMenuScreen;
