import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Character, Class, Race, Ability, Background, Item, Skill, Spell } from '../types';
import { 
    CLASSES_DATA, 
    RACES_DATA, 
    INITIAL_CHARACTER, 
    BACKGROUNDS_DATA,
    STANDARD_ABILITY_SCORES,
    WIZARD_SPELLS,
    NECROMANCER_SPELLS,
    FULL_CASTER_SPELL_SLOTS,
    XP_THRESHOLDS
} from '../constants';
import { calculateBaseAC, calculateMaxHp, getModifierString, calculateModifier } from '../utils/dnd';

interface CharacterCreationScreenProps {
    onStartGame: (character: Character) => void;
}

const CharacterCreationScreen: React.FC<CharacterCreationScreenProps> = ({ onStartGame }) => {
    const [name, setName] = useState('');
    const [charClass, setCharClass] = useState<Class>(Class.Fighter);
    const [race, setRace] = useState(Race.Human);
    const [background, setBackground] = useState(Background.Acolyte);
    const [level, setLevel] = useState(1);
    const [abilityScores, setAbilityScores] = useState<Record<Ability, number>>(INITIAL_CHARACTER.abilities);
    const [equipmentSelections, setEquipmentSelections] = useState<Record<string, string | Item>>({});
    const [selectedClassSkills, setSelectedClassSkills] = useState<Skill[]>([]);
    const [selectedSpells, setSelectedSpells] = useState<Record<'cantrips' | 'level1', Spell[]>>({ cantrips: [], level1: [] });
    
    // ASI State
    const [asiPoints, setAsiPoints] = useState(0);
    const [appliedAsi, setAppliedAsi] = useState<Partial<Record<Ability, number>>>({});

    // Custom Class State
    const [customClassDescription, setCustomClassDescription] = useState('');
    const [primaryAbility, setPrimaryAbility] = useState<Ability>(Ability.Strength);
    const [secondaryAbility, setSecondaryAbility] = useState<Ability>(Ability.Dexterity);


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

        if (charClass !== Class.Custom) {
            setCustomClassDescription('');
        }

    }, [charClass, background]);

    // Update available ASI points when level or applied points change
    useEffect(() => {
        const totalPointsFromLevel = level >= 4 ? 2 : 0;
        if (totalPointsFromLevel === 0 && Object.keys(appliedAsi).length > 0) {
            setAppliedAsi({});
        }
        // Fix: Explicitly type the accumulator for reduce to ensure `pointsSpent` is a number.
        // The value from Object.values can be inferred as unknown, so we coerce it to a number.
        const pointsSpent = Object.values(appliedAsi).reduce<number>((sum, val) => sum + (Number(val) || 0), 0);
        setAsiPoints(totalPointsFromLevel - pointsSpent);
    }, [level, appliedAsi]);

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
        const withAsi: Record<Ability, number> = { ...abilityScores };
        for (const [ability, points] of Object.entries(appliedAsi)) {
            if (typeof points === 'number') {
                withAsi[ability as Ability] += points;
            }
        }

        const final: Record<Ability, number> = withAsi;
        const bonuses = RACES_DATA[race].abilityBonuses || {};
        for (const [ability, bonus] of Object.entries(bonuses)) {
            if (typeof bonus === 'number') {
                final[ability as Ability] += bonus;
            }
        }
        return final;
    }, [abilityScores, race, appliedAsi]);

    const createdCharacter = useMemo((): Omit<Character, 'inventory' | 'skills' | 'spells' | 'spellSlots'> => {
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
        const priority = charClass === Class.Custom
            ? [primaryAbility, secondaryAbility, ...Object.values(Ability).filter(a => a !== primaryAbility && a !== secondaryAbility)]
            : CLASSES_DATA[charClass].abilityPriority;
            
        const scores = [...STANDARD_ABILITY_SCORES].sort((a, b) => b - a);
        const newScores: Record<Ability, number> = {} as Record<Ability, number>;
        priority.forEach((ability, index) => {
            newScores[ability] = scores[index];
        });
        setAbilityScores(newScores);
    }, [charClass, primaryAbility, secondaryAbility]);

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
    
    const handleAsiChange = (ability: Ability, amount: number) => {
        const currentAsi = appliedAsi[ability] || 0;
        const baseScore = abilityScores[ability];

        if (amount > 0) { // Adding a point
            if (asiPoints > 0 && (baseScore + currentAsi + 1) <= 20 && (currentAsi + 1) <= 2) {
                setAppliedAsi(prev => ({ ...prev, [ability]: currentAsi + 1 }));
            }
        } else { // Removing a point
            if (currentAsi > 0) {
                 setAppliedAsi(prev => ({ ...prev, [ability]: currentAsi - 1 }));
            }
        }
    };

    const handleSpellChange = (spell: Spell, type: 'cantrips' | 'level1', checked: boolean) => {
        const spellcastingClassData = CLASSES_DATA[charClass];
        if (!spellcastingClassData.spellChoices) return;
        
        const limit = spellcastingClassData.spellChoices[type] ?? 0;

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
        if (asiPoints > 0) {
            alert(`You have ${asiPoints} ability score improvement point(s) to spend.`);
            return;
        }
        if (charClass === Class.Custom) {
            if (!customClassDescription.trim()) {
                alert('Please enter a description for your custom class.');
                return;
            }
            if (primaryAbility === secondaryAbility) {
                alert('Primary and Secondary abilities must be different.');
                return;
            }
        }
        if (selectedClassSkills.length < classSkillData.count) {
            alert(`Please select ${classSkillData.count} skills for your class.`);
            return;
        }
        if (CLASSES_DATA[charClass].spellChoices) {
            const spellChoices = CLASSES_DATA[charClass].spellChoices!;
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
        
        let spellSlots = {};
        const isFullCaster = [Class.Wizard, Class.Cleric, Class.Necromancer].includes(charClass);
        if (isFullCaster && FULL_CASTER_SPELL_SLOTS[level as keyof typeof FULL_CASTER_SPELL_SLOTS]) {
            const slotsForLevel = FULL_CASTER_SPELL_SLOTS[level as keyof typeof FULL_CASTER_SPELL_SLOTS];
            spellSlots = Object.keys(slotsForLevel).reduce((acc, spellLevel) => {
                const numericSpellLevel = parseInt(spellLevel);
                acc[numericSpellLevel] = { current: slotsForLevel[numericSpellLevel], max: slotsForLevel[numericSpellLevel] };
                return acc;
            }, {} as Record<number, {current: number, max: number}>);
        }

        const startingXp = XP_THRESHOLDS[level - 1] || 0;

        const finalCharacter: Character = {
            ...createdCharacter,
            xp: startingXp,
            inventory: finalInventory,
            skills: [...backgroundSkills, ...selectedClassSkills],
            spells: [...selectedSpells.cantrips, ...selectedSpells.level1],
            classDescription: charClass === Class.Custom ? customClassDescription : undefined,
            spellSlots,
            ... (charClass === Class.Monk && { ki: { current: level, max: level } })
        };
        
        onStartGame(finalCharacter);
    };

    const spellcastingClass = [Class.Wizard, Class.Necromancer].includes(charClass);
    const spellData = charClass === Class.Wizard ? WIZARD_SPELLS : NECROMANCER_SPELLS;
    const spellChoices = spellcastingClass ? CLASSES_DATA[charClass].spellChoices : undefined;

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

                        {/* CUSTOM CLASS SECTION */}
                        {charClass === Class.Custom && (
                            <section className="space-y-4 mt-4 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                                <h3 className="text-lg font-semibold text-yellow-400">Custom Class Details</h3>
                                <div>
                                    <label htmlFor="custom-description" className="block text-sm font-medium text-gray-400 mb-1">Class Description</label>
                                    <textarea 
                                        id="custom-description" 
                                        value={customClassDescription} 
                                        onChange={(e) => setCustomClassDescription(e.target.value)} 
                                        className="w-full h-24 bg-gray-900 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500" 
                                        placeholder="Describe your unique class concept. For example: A warrior who channels elemental energy through their tattoos to enhance their attacks."
                                        required
                                    ></textarea>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="primary-ability" className="block text-sm font-medium text-gray-400 mb-1">Primary Ability</label>
                                        <select id="primary-ability" value={primaryAbility} onChange={(e) => setPrimaryAbility(e.target.value as Ability)} className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500">
                                            {Object.values(Ability).map(ab => <option key={ab} value={ab}>{ab}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="secondary-ability" className="block text-sm font-medium text-gray-400 mb-1">Secondary Ability</label>
                                        <select id="secondary-ability" value={secondaryAbility} onChange={(e) => setSecondaryAbility(e.target.value as Ability)} className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500">
                                             {Object.values(Ability).map(ab => <option key={ab} value={ab}>{ab}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </section>
                        )}

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
                        {spellcastingClass && spellChoices && (
                            <section>
                                <h3 className="text-lg font-semibold text-gray-300 mt-2 mb-2">Spells</h3>
                                <div>
                                    <h4 className="font-semibold text-gray-400 mb-1">Cantrips (Choose {spellChoices.cantrips}) ({selectedSpells.cantrips.length}/{spellChoices.cantrips})</h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        {spellData.cantrips.map(spell => (
                                            <label key={spell.name} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-700">
                                                <input
                                                    type="checkbox"
                                                    className="form-checkbox bg-gray-600 border-gray-500 text-yellow-500 focus:ring-yellow-500"
                                                    checked={selectedSpells.cantrips.some(s => s.name === spell.name)}
                                                    disabled={!selectedSpells.cantrips.some(s => s.name === spell.name) && selectedSpells.cantrips.length >= spellChoices.cantrips}
                                                    onChange={(e) => handleSpellChange(spell, 'cantrips', e.target.checked)}
                                                />
                                                <span>{spell.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="mt-4">
                                <h4 className="font-semibold text-gray-400 mb-1">Level 1 Spells (Choose {spellChoices.level1} for Spellbook) ({selectedSpells.level1.length}/{spellChoices.level1})</h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        {spellData.level1.map(spell => (
                                            <label key={spell.name} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-700">
                                                <input
                                                    type="checkbox"
                                                    className="form-checkbox bg-gray-600 border-gray-500 text-yellow-500 focus:ring-yellow-500"
                                                    checked={selectedSpells.level1.some(s => s.name === spell.name)}
                                                    disabled={!selectedSpells.level1.some(s => s.name === spell.name) && selectedSpells.level1.length >= spellChoices.level1}
                                                    onChange={(e) => handleSpellChange(spell, 'level1', e.target.checked)}
                                                />
                                                <span>{spell.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        )}


                        <div className="flex items-center justify-center pt-4">
                           <button type="submit" className="w-full sm:w-auto bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-6 rounded-md transition duration-200">Begin Adventure</button>
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
                    <p className="text-sm text-gray-400 mb-1">Assign scores from ({STANDARD_ABILITY_SCORES.join(', ')}).</p>
                    {level >= 4 && (
                        <p className="text-sm text-yellow-400 mb-4">Level 4 Reached! Spend {asiPoints} ability point(s). (+1 per point, max +2 per ability).</p>
                    )}
                    <div className="space-y-2">
                        <div className="grid grid-cols-7 items-center gap-2 text-xs text-center font-bold text-gray-400">
                            <span className="col-span-2 text-left">Ability</span>
                            <span>Base</span>
                            <span className="col-span-2">ASI</span>
                            <span>Final</span>
                            <span>Mod</span>
                        </div>
                        {Object.values(Ability).map(ability => {
                            const asiValue = appliedAsi[ability] || 0;
                            const canIncrement = asiPoints > 0 && (abilityScores[ability] + asiValue) < 20 && asiValue < 2;
                            const canDecrement = asiValue > 0;

                            return (
                                <div key={ability} className="grid grid-cols-7 items-center gap-2">
                                    <label className="font-semibold text-gray-300 col-span-2">{ability}</label>
                                    <select 
                                        value={abilityScores[ability]}
                                        onChange={e => handleAbilityChange(ability, e.target.value)}
                                        className="bg-gray-700 border border-gray-600 rounded-md py-1 px-2 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 text-center"
                                    >
                                        <option value={abilityScores[ability]} disabled>{abilityScores[ability]}</option>
                                        {[abilityScores[ability], ...unassignedScores].sort((a,b) => a-b).map(score => <option key={score} value={score}>{score}</option>)}
                                    </select>
                                    
                                    <div className="col-span-2 flex items-center justify-center text-sm">
                                        {level >= 4 ? (
                                            <div className="flex items-center bg-gray-700 rounded">
                                                <button type="button" onClick={() => handleAsiChange(ability, -1)} disabled={!canDecrement} className="px-2 py-1 disabled:opacity-50 hover:bg-gray-600 rounded-l">-</button>
                                                <span className="px-2 font-mono text-white">{asiValue > 0 ? `+${asiValue}` : '0'}</span>
                                                <button type="button" onClick={() => handleAsiChange(ability, 1)} disabled={!canIncrement} className="px-2 py-1 disabled:opacity-50 hover:bg-gray-600 rounded-r">+</button>
                                            </div>
                                        ) : (
                                            <span className="text-gray-500">-</span>
                                        )}
                                    </div>

                                    <div className="text-center font-mono text-lg text-white font-bold">
                                        {finalAbilities[ability]}
                                    </div>
                                    <div className="text-center font-mono text-lg text-yellow-400">
                                        {getModifierString(calculateModifier(finalAbilities[ability]))}
                                    </div>
                                </div>
                            )
                        })}
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