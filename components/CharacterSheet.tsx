import React, { useState } from 'react';
import type { Character } from '../api/types';
import { calculateModifier } from '../utils/dnd';
import { XP_THRESHOLDS } from '../constants';
import HealthBar from './HealthBar';
import StatBlock from './StatBlock';

interface CharacterSheetProps {
    character: Character;
}

type Tab = 'Inventory' | 'Spells' | 'Quests' | 'Features';

const ABILITY_ORDER: { key: keyof Character['abilities']; label: string }[] = [
    { key: 'strength', label: 'STR' },
    { key: 'dexterity', label: 'DEX' },
    { key: 'constitution', label: 'CON' },
    { key: 'intelligence', label: 'INT' },
    { key: 'wisdom', label: 'WIS' },
    { key: 'charisma', label: 'CHA' },
];

const CharacterSheet: React.FC<CharacterSheetProps> = ({ character }) => {
    const [activeTab, setActiveTab] = useState<Tab>('Inventory');

    const xpForNextLevel = character.level < XP_THRESHOLDS.length
        ? XP_THRESHOLDS[character.level]
        : character.xp;

    const classLabel = character.subclass
        ? `${character.char_class} (${character.subclass})`
        : character.char_class;

    const spellSlotEntries = Object.entries(character.spell_slots || {});

    return (
        <div className="flex flex-col h-full text-gray-300 space-y-4">
            <div>
                <h2 className="text-2xl font-bold text-yellow-400 truncate">{character.name}</h2>
                <p className="text-gray-400">{`Level ${character.level} ${character.race} ${classLabel}`}</p>
                <p className="text-sm text-gray-500">XP: {character.xp} / {xpForNextLevel}</p>
                {character.conditions.length > 0 && (
                    <p className="text-xs text-amber-400 mt-1">Conditions: {character.conditions.join(', ')}</p>
                )}
            </div>

            <HealthBar current={character.hp_current} max={character.hp_max} />

            {character.ki_max != null && (
                <div className="mt-2">
                    <div className="flex justify-between items-center mb-1 text-sm">
                        <span className="font-bold text-gray-400">Ki Points</span>
                        <span className="font-mono">{`${character.ki_current ?? 0} / ${character.ki_max}`}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-4">
                        <div
                            className="bg-cyan-400 h-4 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${character.ki_max > 0 ? ((character.ki_current ?? 0) / character.ki_max) * 100 : 0}%` }}
                        ></div>
                    </div>
                </div>
            )}

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

            <div className="grid grid-cols-3 gap-2">
                {ABILITY_ORDER.map(({ key, label }) => (
                    <StatBlock
                        key={key}
                        label={label}
                        score={character.abilities[key]}
                        modifier={calculateModifier(character.abilities[key])}
                    />
                ))}
            </div>

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
                                    {spellSlotEntries.map(([level, slots]) => (
                                        <div key={level} className="text-center bg-gray-900 p-2 rounded">
                                            <div className="text-xs text-gray-500">LVL {level}</div>
                                            <div className="font-mono text-lg">{slots.current}/{slots.maximum}</div>
                                        </div>
                                    ))}
                                    {spellSlotEntries.length === 0 && <p className="text-gray-500 text-xs">No spell slots.</p>}
                                </div>
                            </div>
                            <ul className="space-y-1">
                                {character.spells_known.length > 0 ? character.spells_known.map(spell => (
                                    <li key={spell} className="font-semibold py-1">{spell}</li>
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
                                    <p className="font-semibold">{quest.title} {quest.status !== 'active' ? `(${quest.status})` : ''}</p>
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
