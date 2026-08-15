import React, { useState } from 'react';

interface SettingsScreenProps {
    currentTemperature: number;
    onSave: (newTemperature: number) => void;
    onBack: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ currentTemperature, onSave, onBack }) => {
    const [temperature, setTemperature] = useState(currentTemperature);

    const getCreativityLabel = (value: number) => {
        if (value <= 0.3) return 'Focused & Predictable';
        if (value <= 0.7) return 'Balanced & Creative';
        return 'Wild & Unpredictable';
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-lg bg-gray-800 rounded-lg shadow-xl p-8">
                <h1 className="text-4xl font-bold text-yellow-400 text-center mb-6">Settings</h1>

                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label htmlFor="temperature" className="block text-lg font-medium text-gray-300">
                                GM Creativity
                            </label>
                            <span className="text-yellow-400 font-mono text-lg">{temperature.toFixed(1)}</span>
                        </div>
                        <p className="text-sm text-gray-400 mb-3">
                            Stored locally on this browser. The Game Master itself runs on the backend; the API key stays in <code className="text-gray-300">backend/.env</code> and is not sent to the UI.
                        </p>
                        <input
                            id="temperature"
                            type="range"
                            min="0.1"
                            max="1.0"
                            step="0.1"
                            value={temperature}
                            onChange={(e) => setTemperature(parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="text-center text-gray-500 mt-2 font-semibold">{getCreativityLabel(temperature)}</div>
                    </div>
                </div>

                <div className="flex items-center justify-center space-x-4 mt-8">
                    <button
                        onClick={onBack}
                        className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-8 rounded-md transition duration-200"
                    >
                        Back
                    </button>
                    <button
                        onClick={() => onSave(temperature)}
                        className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-8 rounded-md transition duration-200"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsScreen;
