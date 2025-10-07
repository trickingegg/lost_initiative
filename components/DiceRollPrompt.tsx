import React, { useState } from 'react';
import { Character, AwaitingRollState, RollType } from '../types';
import { calculateModifier } from '../utils/dnd';

interface DiceRollPromptProps {
    character: Character;
    awaitingRoll: AwaitingRollState;
    onRoll: (total: number, d20Roll: number, modifier: number) => void;
    isLoading: boolean;
}

const DiceRollPrompt: React.FC<DiceRollPromptProps> = ({ character, awaitingRoll, onRoll, isLoading }) => {
    const [isRolling, setIsRolling] = useState(false);
    const [result, setResult] = useState<{ d20: number; modifier: number; total: number | null } | null>(null);

    const handleRoll = () => {
        setIsRolling(true);
        setResult(null);

        const modifier = calculateModifier(character.abilities[awaitingRoll.ability]);
        
        let rollCount = 0;
        const rollAnimation = setInterval(() => {
            setResult({ 
                d20: Math.floor(Math.random() * 20) + 1, 
                modifier, 
                total: null 
            });
            rollCount++;
            if (rollCount >= 10) {
                clearInterval(rollAnimation);
                
                const finalD20 = Math.floor(Math.random() * 20) + 1;
                const finalTotal = finalD20 + modifier;
                setResult({ d20: finalD20, modifier, total: finalTotal });

                setTimeout(() => {
                    onRoll(finalTotal, finalD20, modifier);
                }, 1500);
            }
        }, 100);
    };

    const typeText = awaitingRoll.type.replace('_', ' ').toLowerCase();
    const abilityText = awaitingRoll.ability;

    return (
        <div className="w-full bg-gray-700 border border-yellow-500/50 rounded-lg p-4 text-center flex flex-col items-center shadow-lg animate-fade-in">
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            `}</style>
            <h3 className="text-lg font-semibold text-yellow-400">Action Required</h3>
            <p className="text-gray-300 mb-4">
                {awaitingRoll.type === RollType.INITIATIVE
                    ? <span className="font-bold text-white">Roll for Initiative!</span>
                    : `Make a <span class="font-bold">${abilityText} ${typeText}</span>. (Difficulty: ${awaitingRoll.dc})`
                }
            </p>
            
            <div className="h-20 flex items-center justify-center">
                {result && (
                    <div className="text-2xl font-mono">
                        <span className="text-white bg-gray-800 px-2 py-1 rounded">{result.d20}</span>
                        <span className="mx-2 text-yellow-400">{result.modifier >= 0 ? '+' : '-'}</span>
                        <span className="text-white bg-gray-800 px-2 py-1 rounded">{Math.abs(result.modifier)}</span>
                        {result.total !== null && (
                            <>
                                <span className="mx-2 text-yellow-400">=</span>
                                <span className={`text-3xl font-bold ${awaitingRoll.dc > 0 && result.total >= awaitingRoll.dc ? 'text-green-400' : 'text-white'}`}>{result.total}</span>
                            </>
                        )}
                    </div>
                )}
            </div>

            <button
                onClick={handleRoll}
                disabled={isRolling || isLoading}
                className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-2 px-6 rounded-md transition duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center"
            >
                {isRolling || isLoading ? 'Rolling...' : 'Roll d20'}
            </button>
        </div>
    );
};

export default DiceRollPrompt;