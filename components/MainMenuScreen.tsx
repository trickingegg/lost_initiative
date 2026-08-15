import React from 'react';

interface MainMenuScreenProps {
    onNewGame: () => void;
    onLoadGame: () => void;
    onSettings: () => void;
    canLoad: boolean;
    apiKeyConfigured?: boolean;
}

const MainMenuScreen: React.FC<MainMenuScreenProps> = ({ onNewGame, onLoadGame, onSettings, canLoad, apiKeyConfigured = true }) => {
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
                        className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-4 px-6 rounded-md transition duration-200 text-xl"
                    >
                        New Game
                    </button>
                    <button
                        onClick={onLoadGame}
                        disabled={!canLoad}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-md transition duration-200 text-xl disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                        Load Game
                    </button>
                    <button
                        onClick={onSettings}
                        className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-md transition duration-200 text-xl"
                    >
                        Settings
                    </button>
                </div>

                {!apiKeyConfigured && (
                    <p className="mt-8 text-sm text-amber-400">
                        GEMINI_API_KEY is not set. You can create a character, but the Game Master cannot respond until the key is configured.
                    </p>
                )}
            </div>
        </div>
    );
};

export default MainMenuScreen;
