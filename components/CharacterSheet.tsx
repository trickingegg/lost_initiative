import React, { useState } from 'react';
import { Character, Ability } from '../types';
import { calculateModifier, getModifierString } from '../utils/dnd';
import HealthBar from './HealthBar';
import StatBlock from './StatBlock';

interface CharacterSheetProps {
    character: Character;
}

type Tab = 'Inventory' | 'Spells' | 'Quests';

const CharacterSheet: React.FC<CharacterSheetProps> = ({ character }) => {
    const [activeTab, setActiveTab] = useState<Tab>('Inventory');

    return (
        <div className="flex flex-col h-full text-gray-300 space-y-4">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-yellow-400 truncate">{character.name}</h2>
                <p className="text-gray-400">{`Level ${character.level} ${character.race} ${character.class}`}</p>
                <p className="text-sm text-gray-500">XP: {character.xp} / {character.xp + 100} </p>
            </div>

            {/* HP Bar */}
            <HealthBar current={character.hp.current} max={character.hp.max} />

            {/* Core Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-800 p-2 rounded">
                    <div className="font-bold text-sm text-gray-400">Armor Class</div>
                    <div className="text-xl font-mono">{character.ac}</div>
                </div>
                <div className="bg-gray-800 p-2 rounded">
                    <div className="font-bold text-sm text-gray-400">Speed</div>
                    <div className="text-xl font-mono">{character.speed}ft</div>
                </div>
                 <div className="bg-gray-800 p-2 rounded">
                    <div className="font-bold text-sm text-gray-400">Gold</div>
                    <div className="text-xl font-mono">{character.gold}</div>
                </div>
            </div>

            {/* Abilities */}
            <div className="grid grid-cols-3 gap-2">
                {Object.values(Ability).map(ability => (
                    <StatBlock 
                        key={ability} 
                        label={ability.substring(0, 3).toUpperCase()} 
                        score={character.abilities[ability]} 
                        modifier={calculateModifier(character.abilities[ability])} 
                    />
                ))}
            </div>

            {/* Tabs */}
            <div className="flex-grow flex flex-col min-h-0">
                <div className="border-b border-gray-700 flex">
                    {(['Inventory', 'Spells', 'Quests'] as Tab[]).map(tab => (
                        <button 
                            key={tab} 
                            onClick={() => setActiveTab(tab)}
                            className={`py-2 px-4 text-sm font-medium ${activeTab === tab ? 'border-b-2 border-yellow-400 text-yellow-400' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
                <div className="bg-gray-800 rounded-b p-3 flex-grow overflow-y-auto">
                    {activeTab === 'Inventory' && (
                        <ul className="space-y-2 text-sm">
                            {character.inventory.length > 0 ? character.inventory.map(item => (
                                <li key={item.name} className="flex justify-between">
                                    <span>{item.name}</span>
                                    <span className="text-gray-400">x{item.quantity}</span>
                                </li>
                            )) : <li className="text-gray-500">Your inventory is empty.</li>}
                        </ul>
                    )}
                    {activeTab === 'Spells' && (
                         <ul className="space-y-2 text-sm">
                            {character.spells.length > 0 ? character.spells.map(spell => (
                                <li key={spell.name}>
                                    <p className="font-semibold">{spell.name}</p>
                                    <p className="text-xs text-gray-400">{spell.description}</p>
                                </li>
                            )) : <li className="text-gray-500">You know no spells.</li>}
                        </ul>
                    )}
                    {activeTab === 'Quests' && (
                         <ul className="space-y-3 text-sm">
                            {character.quests.length > 0 ? character.quests.map(quest => (
                                <li key={quest.title}>
                                    <p className="font-semibold">{quest.title} {quest.isActive ? '' : '(Completed)'}</p>
                                    <p className="text-xs text-gray-400">{quest.description}</p>
                                </li>
                            )) : <li className="text-gray-500">You have no active quests.</li>}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CharacterSheet;
