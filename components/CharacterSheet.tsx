import React, { useState } from 'react';
import { Character, Ability } from '../types';
import { calculateModifier, getModifierString } from '../utils/dnd';
import { XP_THRESHOLDS } from '../constants';
import HealthBar from './HealthBar';
import StatBlock from './StatBlock';

interface CharacterSheetProps {
    character: Character;
}

type Tab = 'Inventory' | 'Spells' | 'Quests' | 'Features';

const CharacterSheet: React.FC<CharacterSheetProps> = ({ character }) => {
    const [activeTab, setActiveTab] = useState<Tab>('Inventory');

    const xpForNextLevel = character.level < XP_THRESHOLDS.length 
        ? XP_THRESHOLDS[character.level] 
        : character.xp; // At max level, just show current xp

    return (
        <div className="flex flex-col h-full text-gray-300 space-y-4">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-yellow-400 truncate">{character.name}</h2>
                <p className="text-gray-400">{`Level ${character.level} ${character.race} ${character.archetype ? character.archetype.name : character.class}`}</p>
                <p className="text-sm text-gray-500">XP: {character.xp} / {xpForNextLevel} </p>
            </div>

            {/* HP Bar */}
            <HealthBar current={character.hp.current} max={character.hp.max} />

            {/* Ki Points */}
            {character.ki && (
                <div className="mt-2">
                    <div className="flex justify-between items-center mb-1 text-sm">
                        <span className="font-bold text-gray-400">Ki Points</span>
                        <span className="font-mono">{`${character.ki.current} / ${character.ki.max}`}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-4">
                        <div
                            className="bg-cyan-400 h-4 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${character.ki.max > 0 ? (character.ki.current / character.ki.max) * 100 : 0}%` }}
                        ></div>
                    </div>
                </div>
            )}


            {/* Core Stats */}
            <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-gray-800 p-2 rounded">
                    <div className="font-bold text-sm text-gray-400">Armor Class</div>
                    <div className="text-xl font-mono">{character.ac}</div>
                </div>
                <div className="bg-gray-800 p-2 rounded">
                    <div className="font-bold text-sm text-gray-400">Speed</div>
                    <div className="text-xl font-mono">{character.speed}ft</div>
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
                    {(['Inventory', 'Spells', 'Features', 'Quests'] as Tab[]).map(tab => (
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
                         <div className="space-y-4 text-sm">
                            <div className="mb-2">
                                <h4 className="font-semibold text-gray-400 border-b border-gray-700 pb-1 mb-2">Spell Slots</h4>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(character.spellSlots).map(([level, slots]) => (
                                        <div key={level} className="text-center bg-gray-900 p-2 rounded">
                                            <div className="text-xs text-gray-500">LVL {level}</div>
                                            {/* FIX: Cast 'slots' to 'any' to bypass incorrect 'unknown' type inference from Object.entries. */}
                                            <div className="font-mono text-lg">{(slots as any).current}/{(slots as any).max}</div>
                                        </div>
                                    ))}
                                    {Object.keys(character.spellSlots).length === 0 && <p className="text-gray-500 text-xs">No spell slots.</p>}
                                </div>
                            </div>
                            <ul className="space-y-1">
                                {character.spells.length > 0 ? character.spells.map(spell => (
                                    <li key={spell.name} className="group relative">
                                        <p className="font-semibold cursor-default py-1">{spell.name}</p>
                                        <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-gray-900 border border-gray-600 rounded-md shadow-lg text-xs text-gray-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-300 z-10 pointer-events-none">
                                            <h5 className="font-bold text-white mb-1">{spell.name}</h5>
                                            {spell.description}
                                        </div>
                                    </li>
                                )) : <li className="text-gray-500">You know no spells.</li>}
                            </ul>
                        </div>
                    )}
                     {activeTab === 'Features' && (
                         <ul className="space-y-3 text-sm">
                            {character.features.length > 0 ? character.features.map(feature => (
                                <li key={feature.name}>
                                    <p className="font-semibold">{feature.name}</p>
                                    <p className="text-xs text-gray-400">{feature.description}</p>
                                </li>
                            )) : <li className="text-gray-500">You have no special features.</li>}
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