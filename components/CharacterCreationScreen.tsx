import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Character, Class, Race, Ability, Background, Item, Skill, Spell } from '../types';
import { 
    CLASSES_DATA, 
    RACES_DATA, 
    INITIAL_CHARACTER, 
    BACKGROUNDS_DATA,
    STANDARD_ABILITY_SCORES,
    WIZARD_SPELLS
} from '../constants';
import { calculateBaseAC, calculateMaxHp, getModifierString, calculateModifier } from '../utils/dnd';

interface CharacterCreationScreenProps {
    onStartGame: (character: Character) => void;
    onLoadGame: () => void;
    onNewGame: () => void;
}

const CharacterCreationScreen: React.FC<CharacterCreationScreenProps> = ({ onStartGame, onLoadGame }) => {
    const [name, setName] = useState('');
    const [charClass, setCharClass] = useState(Class.Fighter);
    const [race, setRace] = useState(Race.Human);
    const [background, setBackground] = useState(Background.Acolyte);
    const [level, setLevel] = useState(1);
    const [abilityScores, setAbilityScores] = useState<Record<Ability, number>>(INITIAL_CHARACTER.abilities);
    const [equipmentSelections, setEquipmentSelections] = useState<Record<string, string | Item>>({});
    const [selectedClassSkills, setSelectedClassSkills] = useState<Skill[]>([]);
    const [selectedSpells, setSelectedSpells] = useState<Record<'cantrips' | 'level1', Spell[]>>({ cantrips: [], level1: [] });

    const unassignedScores = useMemo(() => {
        const assigned = Object.values(abilityScores);
        const allScores = [...STANDARD_ABILITY_SCORES];
        assigned.forEach(score => {
            const index = allScores.indexOf(score as number);
            if (index > -1) {
                allScores.splice(index, 1);
            }
        });
        return allScores;
    }, [abilityScores]);
    
    // Reset selections when class or background changes
    useEffect(() => {
        // Reset equipment
        const initialSelections: Record<string, string | Item> = {};
        const classChoices = CLASSES_DATA[charClass].equipmentChoices;
        classChoices.forEach(choiceGroup => {
            const key = Object.keys(choiceGroup)[0];
            initialSelections[key] = choiceGroup[key][0];
        });
        setEquipmentSelections(initialSelections);
        // Reset skills
        setSelectedClassSkills([]);
        // Reset spells
        setSelectedSpells({ cantrips: [], level1: [] });
    }, [charClass, background]);

    const handleAbilityChange = (ability: Ability, value: string) => {
        const newScore = parseInt(value);
        if (isNaN(newScore)) return;

        const oldScore = abilityScores[ability];
        const swappedAbility = Object.entries(abilityScores).find(([,score]) => score === newScore)?.[0] as Ability | undefined;

        setAbilityScores(prev => {
            const newAbilities = {...prev};
            newAbilities[ability] = newScore;
            if (swappedAbility && swappedAbility !== ability) {
                newAbilities[swappedAbility] = oldScore;
            }
            return newAbilities;
        });
    };
    
    const finalAbilities = useMemo(() => {
        const final: Record<Ability, number> = { ...abilityScores };
        const bonuses = RACES_DATA[race].abilityBonuses || {};
        for (const [ability, bonus] of Object.entries(bonuses)) {
            // FIX: Add a type guard to ensure bonus is a number before performing addition.
            if (typeof bonus === 'number') {
                final[ability as Ability] += bonus;
            }
        }
        return final;
    }, [abilityScores, race]);

    const createdCharacter = useMemo((): Omit<Character, 'inventory' | 'gold' | 'skills' | 'spells'> => {
        const maxHp = calculateMaxHp(level, charClass, finalAbilities[Ability.Constitution]);
        const ac = calculateBaseAC(finalAbilities[Ability.Dexterity]);
        
        return {
            ...INITIAL_CHARACTER,
            name,
            race,
            class: charClass,
            background,
            level,
            abilities: finalAbilities,
            hp: { current: maxHp, max: maxHp },
            ac,
        };
    }, [name, race, charClass, background, level, finalAbilities]);

    const handleSuggestStats = useCallback(() => {
        const priority = CLASSES_DATA[charClass].abilityPriority;
        const scores = [...STANDARD_ABILITY_SCORES].sort((a, b) => b - a);
        const newScores: Record<Ability, number> = {} as Record<Ability, number>;
        priority.forEach((ability, index) => {
            newScores[ability] = scores[index];
        });
        setAbilityScores(newScores);
    }, [charClass]);

    const backgroundSkills = useMemo(() => BACKGROUNDS_DATA[background].skillProficiencies, [background]);
    const classSkillData = useMemo(() => CLASSES_DATA[charClass].skillChoices, [charClass]);
    
    const handleSkillChange = (skill: Skill, checked: boolean) => {
        setSelectedClassSkills(prev => {
            if (checked) {
                if (prev.length < classSkillData.count) {
                    return [...prev, skill];
                }
                return prev; // Don't add if limit is reached
            } else {
                return prev.filter(s => s !== skill);
            }
        });
    };

    const handleSpellChange = (spell: Spell, type: 'cantrips' | 'level1', checked: boolean) => {
        const limit = CLASSES_DATA[Class.Wizard].spellChoices?.[type] ?? 0;
        setSelectedSpells(prev => {
            const currentList = prev[type];
            if (checked) {
                if (currentList.length < limit) {
                    return { ...prev, [type]: [...currentList, spell] };
                }
                return prev;
            } else {
                return { ...prev, [type]: currentList.filter(s => s.name !== spell.name) };
            }
        });
    };

    const handleStart = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            alert('Please enter a character name.');
            return;
        }
        if (unassignedScores.length > 0) {
             alert('Please assign all ability scores from the standard array.');
             return;
        }
        if (selectedClassSkills.length < classSkillData.count) {
            alert(`Please select ${classSkillData.count} skills for your class.`);
            return;
        }
        if (charClass === Class.Wizard) {
            const spellChoices = CLASSES_DATA[Class.Wizard].spellChoices!;
            if (selectedSpells.cantrips.length < spellChoices.cantrips) {
                alert(`Please select ${spellChoices.cantrips} cantrips.`);
                return;
            }
            if (selectedSpells.level1.length < spellChoices.level1) {
                alert(`Please select ${spellChoices.level1} level 1 spells for your spellbook.`);
                return;
            }
        }

        // Combine equipment
        const finalInventory: Item[] = [];
        BACKGROUNDS_DATA[background].equipment.forEach(item => {
            finalInventory.push(typeof item === 'string' ? { name: item, quantity: 1 } : item);
        });
        Object.values(equipmentSelections).forEach(item => {
             if (typeof item === 'string') {
                if (item.includes('&')) {
                    item.split('&').forEach(part => {
                        const trimmedPart = part.trim();
                        if (trimmedPart.includes('Quiver of 20 Arrows')) {
                            finalInventory.push({ name: 'Quiver', quantity: 1});
                            finalInventory.push({ name: 'Arrows', quantity: 20});
                        } else {
                            finalInventory.push({ name: trimmedPart, quantity: 1 });
                        }
                    })
                } else {
                    finalInventory.push({ name: item, quantity: 1 });
                }
            } else {
                finalInventory.push(item as Item);
            }
        });

        const finalCharacter: Character = {
            ...createdCharacter,
            inventory: finalInventory,
            gold: BACKGROUNDS_DATA[background].gold,
            skills: [...backgroundSkills, ...selectedClassSkills],
            spells: [...selectedSpells.cantrips, ...selectedSpells.level1],
        };
        
        onStartGame(finalCharacter);
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-6xl bg-gray-800 rounded-lg shadow-xl p-6 flex flex-col md:flex-row md:space-x-6">
                {/* Left Side: Form */}
                <div className="w-full md:w-1/2 md:pr-4 overflow-y-auto max-h-[85vh]">
                    <h1 className="text-4xl font-bold text-yellow-400 text-center mb-6">Create Your Hero</h1>
                    <form onSubmit={handleStart} className="space-y-4">
                        <section>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500" required />
                        </section>
                        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="race" className="block text-sm font-medium text-gray-400 mb-1">Race</label>
                                <select id="race" value={race} onChange={(e) => setRace(e.target.value as Race)} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500">
                                    {Object.values(Race).map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="class" className="block text-sm font-medium text-gray-400 mb-1">Class</label>
                                <select id="class" value={charClass} onChange={(e) => setCharClass(e.target.value as Class)} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500">
                                    {Object.values(Class).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </section>
                        <section>
                           <label htmlFor="background" className="block text-sm font-medium text-gray-400 mb-1">Background</label>
                           <select id="background" value={background} onChange={(e) => setBackground(e.target.value as Background)} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500">
                               {Object.values(Background).map(b => <option key={b} value={b}>{b}</option>)}
                           </select>
                        </section>
                        <section>
                             <label htmlFor="level" className="block text-sm font-medium text-gray-400 mb-1">Starting Level: {level}</label>
                             <input type="range" id="level" min="1" max="5" value={level} onChange={e => setLevel(parseInt(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                        </section>
                        <section>
                            <h3 className="text-lg font-semibold text-gray-300 mt-2 mb-2">Class Equipment</h3>
                            <div className="space-y-3">
                                {CLASSES_DATA[charClass].equipmentChoices.map(choiceGroup => {
                                    const key = Object.keys(choiceGroup)[0];
                                    const options = choiceGroup[key];
                                    return (
                                        <div key={key}>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">{key}</label>
                                            <select 
                                                onChange={e => setEquipmentSelections(prev => ({ ...prev, [key]: e.target.value }))}
                                                className="w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                                            >
                                                {options.map(opt => {
                                                    const optionName = typeof opt === 'string' ? opt : opt.name;
                                                    return <option key={optionName} value={optionName}>{optionName}</option>
                                                })}
                                            </select>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                         {/* Skills Section */}
                        <section>
                            <h3 className="text-lg font-semibold text-gray-300 mt-2 mb-2">Skills</h3>
                            <p className="text-sm text-gray-400 mb-2">
                                You get <span className="font-bold text-white">{backgroundSkills.join(', ')}</span> from your background.
                                <br/>
                                Choose {classSkillData.count} more from your class list. 
                                ({selectedClassSkills.length}/{classSkillData.count})
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                {classSkillData.from.map(skill => {
                                    const isFromBackground = backgroundSkills.includes(skill);
                                    return (
                                        <label key={skill} className={`flex items-center space-x-2 p-2 rounded ${isFromBackground ? 'text-gray-500' : 'hover:bg-gray-700'}`}>
                                            <input 
                                                type="checkbox"
                                                className="form-checkbox bg-gray-600 border-gray-500 text-yellow-500 focus:ring-yellow-500"
                                                checked={isFromBackground || selectedClassSkills.includes(skill)}
                                                disabled={isFromBackground || (!selectedClassSkills.includes(skill) && selectedClassSkills.length >= classSkillData.count)}
                                                onChange={(e) => handleSkillChange(skill, e.target.checked)}
                                            />
                                            <span>{skill}</span>
                                        </label>
                                    )
                                })}
                            </div>
                        </section>
                        {/* Spell Section */}
                        {charClass === Class.Wizard && (
                             <section>
                                <h3 className="text-lg font-semibold text-gray-300 mt-2 mb-2">Spells</h3>
                                <div>
                                    <h4 className="font-semibold text-gray-400 mb-1">Cantrips (Choose {CLASSES_DATA.Wizard.spellChoices?.cantrips}) ({selectedSpells.cantrips.length}/{CLASSES_DATA.Wizard.spellChoices?.cantrips})</h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        {WIZARD_SPELLS.cantrips.map(spell => (
                                             <label key={spell.name} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-700">
                                                <input 
                                                    type="checkbox"
                                                    className="form-checkbox bg-gray-600 border-gray-500 text-yellow-500 focus:ring-yellow-500"
                                                    checked={selectedSpells.cantrips.some(s => s.name === spell.name)}
                                                    disabled={!selectedSpells.cantrips.some(s => s.name === spell.name) && selectedSpells.cantrips.length >= (CLASSES_DATA.Wizard.spellChoices?.cantrips ?? 0)}
                                                    onChange={(e) => handleSpellChange(spell, 'cantrips', e.target.checked)}
                                                />
                                                <span>{spell.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                 <div className="mt-4">
                                    <h4 className="font-semibold text-gray-400 mb-1">Level 1 Spells (Choose {CLASSES_DATA.Wizard.spellChoices?.level1} for Spellbook) ({selectedSpells.level1.length}/{CLASSES_DATA.Wizard.spellChoices?.level1})</h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        {WIZARD_SPELLS.level1.map(spell => (
                                             <label key={spell.name} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-700">
                                                <input 
                                                    type="checkbox"
                                                    className="form-checkbox bg-gray-600 border-gray-500 text-yellow-500 focus:ring-yellow-500"
                                                    checked={selectedSpells.level1.some(s => s.name === spell.name)}
                                                    disabled={!selectedSpells.level1.some(s => s.name === spell.name) && selectedSpells.level1.length >= (CLASSES_DATA.Wizard.spellChoices?.level1 ?? 0)}
                                                    onChange={(e) => handleSpellChange(spell, 'level1', e.target.checked)}
                                                />
                                                <span>{spell.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        )}


                        <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 pt-4">
                            <button type="submit" className="w-full sm:w-auto bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-6 rounded-md transition duration-200">Begin Adventure</button>
                            <button type="button" onClick={onLoadGame} className="w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-md transition duration-200">Load Game</button>
                        </div>
                    </form>
                </div>

                {/* Right Side: Stats */}
                <div className="w-full md:w-1/2 mt-8 md:mt-0 bg-gray-900 p-6 rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                         <h2 className="text-2xl font-bold text-yellow-400">Abilities & Stats</h2>
                         <button 
                            type="button" 
                            onClick={handleSuggestStats}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-1 px-3 rounded-md transition duration-200"
                            >
                            Suggest Stats
                        </button>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">Assign scores from ({STANDARD_ABILITY_SCORES.join(', ')}). Race bonuses are added automatically.</p>
                    <div className="space-y-2">
                        <div className="grid grid-cols-5 items-center gap-2 text-xs text-center font-bold text-gray-400">
                            <span className="col-span-2 text-left">Ability</span>
                            <span>Base</span>
                            <span>Final</span>
                            <span>Mod</span>
                        </div>
                        {Object.values(Ability).map(ability => (
                            <div key={ability} className="grid grid-cols-5 items-center gap-2">
                                <label className="font-semibold text-gray-300 col-span-2">{ability}</label>
                                <select 
                                    value={abilityScores[ability]}
                                    onChange={e => handleAbilityChange(ability, e.target.value)}
                                    className="bg-gray-700 border border-gray-600 rounded-md py-1 px-2 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 text-center"
                                >
                                    <option value={abilityScores[ability]} disabled>{abilityScores[ability]}</option>
                                    {[abilityScores[ability], ...unassignedScores].sort((a,b) => a-b).map(score => <option key={score} value={score}>{score}</option>)}
                                </select>
                                <div className="text-center font-mono text-lg text-white font-bold">
                                    {finalAbilities[ability]}
                                </div>
                                <div className="text-center font-mono text-lg text-yellow-400">
                                    {getModifierString(calculateModifier(finalAbilities[ability]))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-6 border-t border-gray-700 pt-4 text-center grid grid-cols-2 gap-4">
                         <div>
                            <div className="font-bold text-sm text-gray-400">Max HP</div>
                            <div className="text-2xl font-mono">{createdCharacter.hp.max}</div>
                        </div>
                        <div>
                            <div className="font-bold text-sm text-gray-400">Armor Class</div>
                            <div className="text-2xl font-mono">{createdCharacter.ac}</div>
                        </div>
                    </div>
                     <div className="mt-4 border-t border-gray-700 pt-4">
                        <h3 className="font-semibold text-gray-300">Background Info</h3>
                        <p className="text-sm text-gray-400 mt-1">{RACES_DATA[race].description}</p>
                        <p className="text-sm text-gray-400 mt-1">{CLASSES_DATA[charClass].description}</p>
                        <p className="text-sm text-gray-400 mt-1">{BACKGROUNDS_DATA[background].description}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CharacterCreationScreen;