import React, { useState } from 'react';

interface AdventureSetupScreenProps {
    onSetupComplete: (setting: string) => void;
    onBack: () => void;
}

const SETTINGS = {
    'Classic Fantasy': 'A world of swords, sorcery, mythical creatures, and epic quests. Think dragons, elves, and ancient ruins.',
    'Dark Fantasy': 'A gritty, morally ambiguous world where magic is dangerous and costly. Heroes are flawed and victories are bittersweet.',
    'Cyberpunk': 'A high-tech, low-life future. Megacorporations rule from neon-drenched skyscrapers while cybernetically enhanced gangs fight for survival in the gutter.',
    'Cosmic Horror': 'A universe of sanity-bending dread. Players confront incomprehensible entities from beyond the stars, where knowledge itself is a curse.',
    'Post-Apocalyptic': 'A desolate wasteland, ravaged by a past cataclysm. Survivors scavenge for resources, battle mutated creatures, and try to rebuild civilization.',
    'Steampunk': 'An alternate history where steam power fuels incredible inventions. Clockwork automatons, airships, and gas-lit streets define this age of industry and adventure.',
    'Custom': 'Describe your own unique world.',
};

type SettingKey = keyof typeof SETTINGS;

const AdventureSetupScreen: React.FC<AdventureSetupScreenProps> = ({ onSetupComplete, onBack }) => {
    const [selectedSetting, setSelectedSetting] = useState<SettingKey>('Classic Fantasy');
    const [customSettingText, setCustomSettingText] = useState('');

    const handleContinue = () => {
        if (selectedSetting === 'Custom') {
            if (customSettingText.trim()) {
                onSetupComplete(customSettingText.trim());
            } else {
                alert('Please describe your custom setting.');
            }
        } else {
            onSetupComplete(SETTINGS[selectedSetting]);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-4xl bg-gray-800 rounded-lg shadow-xl p-8">
                <h1 className="text-4xl font-bold text-yellow-400 text-center mb-2">Setup Your Adventure</h1>
                <p className="text-center text-gray-400 mb-8">Choose a setting or create your own to begin.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {Object.entries(SETTINGS).map(([key, description]) => (
                        <div
                            key={key}
                            onClick={() => setSelectedSetting(key as SettingKey)}
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                                selectedSetting === key ? 'border-yellow-500 bg-gray-700/50' : 'border-gray-700 hover:border-gray-600 hover:bg-gray-700/30'
                            }`}
                        >
                            <h3 className="font-bold text-lg text-white">{key}</h3>
                            <p className="text-sm text-gray-400 mt-1">{description}</p>
                        </div>
                    ))}
                </div>

                {selectedSetting === 'Custom' && (
                    <div className="mb-6">
                        <textarea
                            value={customSettingText}
                            onChange={(e) => setCustomSettingText(e.target.value)}
                            placeholder="For example: A magical world set inside a giant, continent-sized library, where books are landscapes and ink is the source of all magic..."
                            className="w-full h-24 bg-gray-700 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                        />
                    </div>
                )}

                <div className="text-center mt-8 flex justify-center items-center space-x-4">
                    <button 
                        onClick={onBack}
                        className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-8 rounded-md transition duration-200 text-lg"
                    >
                        Back to Menu
                    </button>
                    <button 
                        onClick={handleContinue}
                        className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-8 rounded-md transition duration-200 text-lg"
                    >
                        Continue to Character Creation
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdventureSetupScreen;