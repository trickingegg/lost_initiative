import React, { useState, useMemo, useEffect } from 'react';
import { Character, Spell, Class, AwaitingLevelUpChoices, Archetype } from '../types';
import { WIZARD_SPELLS, NECROMANCER_SPELLS, FULL_CASTER_SPELL_SLOTS } from '../constants';

interface LevelUpScreenProps {
    character: Character;
    levelUpChoices: AwaitingLevelUpChoices;
    onComplete: (choices: { spells?: Spell[], archetype?: Archetype }) => void;
}

const LevelUpScreen: React.FC<LevelUpScreenProps> = ({ character, levelUpChoices, onComplete }) => {
    const { level: newLevel, archetypeChoice, spellChoice } = levelUpChoices;
    
    const [selectedSpells, setSelectedSpells] = useState<Spell[]>([]);
    const [selectedArchetype, setSelectedArchetype] = useState<Archetype | null>(null);

    useEffect(() => {
        // If there's only one archetype choice, pre-select it.
        if (archetypeChoice && archetypeChoice.from.length === 1) {
            setSelectedArchetype(archetypeChoice.from[0]);
        }
    }, [archetypeChoice]);


    const isSpellcasterLevelUp = useMemo(() => {
        return [Class.Wizard, Class.Necromancer].includes(character.class);
    }, [character.class]);
    
    const spellsToLearnCount = useMemo(() => {
        if (spellChoice) {
            return spellChoice.count;
        }
        // Fallback for regular in-game level up if spellChoice is not provided.
        // Wizards learn 2 spells per level.
        return isSpellcasterLevelUp ? 2 : 0;
    }, [spellChoice, isSpellcasterLevelUp]);


    const availableSpells = useMemo(() => {
        if (!isSpellcasterLevelUp) return [];

        const allSpellData = character.class === Class.Wizard ? WIZARD_SPELLS : NECROMANCER_SPELLS;
        // Determine the highest level of spell the wizard can cast
        const slotsForNewLevel = FULL_CASTER_SPELL_SLOTS[newLevel as keyof typeof FULL_CASTER_SPELL_SLOTS];
        if (!slotsForNewLevel) return [];
        const highestSpellLevel = Math.max(...Object.keys(slotsForNewLevel).map(Number));
        
        // Collate all spells up to the highest castable level
        let potentialSpells: Spell[] = [];
        for (let i = 1; i <= highestSpellLevel; i++) {
            const levelKey = `level${i}` as keyof typeof allSpellData;
            if (allSpellData[levelKey]) {
                potentialSpells.push(...(allSpellData[levelKey] as Spell[]));
            }
        }

        const knownSpellNames = new Set(character.spells.map(s => s.name));
        return potentialSpells.filter(spell => !knownSpellNames.has(spell.name));

    }, [character, newLevel, isSpellcasterLevelUp]);

    const handleSpellToggle = (spell: Spell) => {
        setSelectedSpells(prev => {
            const isSelected = prev.some(s => s.name === spell.name);
            if (isSelected) {
                return prev.filter(s => s.name !== spell.name);
            } else {
                if (prev.length < spellsToLearnCount) {
                    return [...prev, spell];
                }
            }
            return prev;
        });
    };

    const handleConfirm = () => {
        // Check if all choices have been made
        const allChoicesMade = (!archetypeChoice || selectedArchetype) && (selectedSpells.length === spellsToLearnCount);

        if (allChoicesMade) {
            onComplete({ 
                spells: selectedSpells,
                archetype: selectedArchetype || undefined,
             });
        }
    };

    const allChoicesMade = (!archetypeChoice || selectedArchetype) && (selectedSpells.length === spellsToLearnCount);

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-3xl bg-gray-800 rounded-lg shadow-xl p-8 border-2 border-yellow-500">
                <h1 className="text-5xl font-bold text-yellow-400 text-center mb-2">Level Up!</h1>
                <p className="text-center text-gray-300 text-xl mb-6">
                    Congratulations, you've reached Level {newLevel}!
                </p>

                <div className="bg-gray-700/50 p-4 rounded-md space-y-6">
                    {/* Archetype Selection */}
                    {archetypeChoice && (
                         <section>
                            <h2 className="text-2xl font-semibold text-white mb-2">Choose Your Path</h2>
                            <p className="text-gray-400 mb-4">
                                At level 3, you specialize. This choice is permanent and defines your character's abilities.
                            </p>
                            <div className="space-y-3">
                                {archetypeChoice.from.map(archetype => (
                                    <div 
                                        key={archetype.name}
                                        onClick={() => setSelectedArchetype(archetype)}
                                        className={`p-4 rounded-md cursor-pointer transition-all duration-200 border-2 ${selectedArchetype?.name === archetype.name ? 'border-yellow-500 bg-gray-900/50' : 'border-transparent bg-gray-900/50 hover:border-gray-600'}`}
                                    >
                                        <h3 className="font-bold text-lg text-yellow-400">{archetype.name}</h3>
                                        <p className="text-sm text-gray-300 mt-1">{archetype.description}</p>
                                        <div className="mt-2 border-t border-gray-700 pt-2">
                                            <h4 className="font-semibold text-sm text-gray-400">Level 3 Feature:</h4>
                                            {archetype.features[3]?.map(feature => (
                                                 <div key={feature.name}>
                                                    <p className="text-sm font-semibold text-white">{feature.name}</p>
                                                    <p className="text-xs text-gray-400">{feature.description}</p>
                                                 </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}


                    {/* Spell Selection */}
                    {isSpellcasterLevelUp && spellsToLearnCount > 0 && (
                        <section>
                            <h2 className="text-2xl font-semibold text-white mb-2">Learn New Spells</h2>
                            <p className="text-gray-400 mb-4">
                                Your arcane knowledge expands. Choose {spellsToLearnCount} new spells to add to your spellbook permanently. 
                                ({selectedSpells.length}/{spellsToLearnCount})
                            </p>
                            <div className="max-h-60 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-2 pr-2">
                                {availableSpells.map(spell => (
                                    <label 
                                        key={spell.name} 
                                        className={`flex items-start space-x-3 p-3 rounded-md cursor-pointer transition-colors duration-200 group ${selectedSpells.some(s => s.name === spell.name) ? 'bg-yellow-800/50' : 'bg-gray-900/50 hover:bg-gray-900'}`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="form-checkbox bg-gray-600 border-gray-500 text-yellow-500 focus:ring-yellow-500 mt-1"
                                            checked={selectedSpells.some(s => s.name === spell.name)}
                                            disabled={!selectedSpells.some(s => s.name === spell.name) && selectedSpells.length >= spellsToLearnCount}
                                            onChange={() => handleSpellToggle(spell)}
                                        />
                                        <div>
                                            <span className="font-semibold text-white">{spell.name}</span>
                                            <p className="text-sm text-gray-400 group-hover:text-gray-300">{spell.description}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </section>
                    )}
                    
                    {!isSpellcasterLevelUp && !archetypeChoice && (
                        <p className="text-center text-gray-300">Your might and skill have grown!</p>
                    )}
                </div>

                <div className="text-center mt-8">
                    <button
                        onClick={handleConfirm}
                        disabled={!allChoicesMade}
                        className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-8 rounded-md transition duration-200 text-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                        Confirm Choices & Continue
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LevelUpScreen;