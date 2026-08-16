import React, { useState } from 'react';
import type { Character, RollRequest } from '../sessionApi/types';
import { rollModifier } from '../sessionApi/mappers';

interface DiceRollPromptProps {
    character: Character;
    awaitingRoll: RollRequest;
    onRoll: (total: number, natural: number) => void;
    isLoading: boolean;
}

const DiceRollPrompt: React.FC<DiceRollPromptProps> = ({ character, awaitingRoll, onRoll, isLoading }) => {
    const [isRolling, setIsRolling] = useState(false);
    const [result, setResult] = useState<{ d20: number; modifier: number; proficiency: number; total: number | null } | null>(null);

    const breakdown = rollModifier(character, awaitingRoll);

    const handleRoll = () => {
        setIsRolling(true);
        setResult(null);

        let rollCount = 0;
        const rollAnimation = setInterval(() => {
            setResult({
                d20: Math.floor(Math.random() * 20) + 1,
                modifier: breakdown.abilityMod,
                proficiency: breakdown.proficiency,
                total: null,
            });
            rollCount++;
            if (rollCount >= 10) {
                clearInterval(rollAnimation);

                const finalD20 = Math.floor(Math.random() * 20) + 1;
                const finalTotal = finalD20 + breakdown.total;
                setResult({
                    d20: finalD20,
                    modifier: breakdown.abilityMod,
                    proficiency: breakdown.proficiency,
                    total: finalTotal,
                });

                setTimeout(() => {
                    onRoll(finalTotal, finalD20);
                }, 1500);
            }
        }, 100);
    };

    const typeText = awaitingRoll.type.replace(/_/g, ' ').toLowerCase();
    const critClass = result?.total !== null && result.d20 === 20
        ? 'text-green-400'
        : result?.total !== null && result.d20 === 1
            ? 'text-red-400'
            : awaitingRoll.dc > 0 && result?.total !== null && result.total >= awaitingRoll.dc
                ? 'text-green-400'
                : 'text-white';

    return (
        <div className="w-full bg-gray-700 border border-yellow-500/50 rounded-lg p-4 text-center flex flex-col items-center shadow-lg">
            <h3 className="text-lg font-semibold text-yellow-400">Action Required</h3>
            <p className="text-gray-300 mb-1">
                Make a <span className="font-bold">{awaitingRoll.ability} {typeText}</span>. (Difficulty: {awaitingRoll.dc})
            </p>
            <p className="text-xs text-gray-400 mb-2">
                Modifier {breakdown.abilityMod >= 0 ? '+' : ''}{breakdown.abilityMod}
                {breakdown.proficiency > 0 ? ` + proficiency ${breakdown.proficiency}` : ''}
                {breakdown.skillName ? ` (${breakdown.skillName})` : ''}
            </p>
            {awaitingRoll.reason && (
                <p className="text-sm text-gray-400 mb-4">{awaitingRoll.reason}</p>
            )}

            <div className="h-20 flex items-center justify-center">
                {result && (
                    <div className="text-2xl font-mono">
                        <span className="text-white bg-gray-800 px-2 py-1 rounded">{result.d20}</span>
                        <span className="mx-2 text-yellow-400">{breakdown.total >= 0 ? '+' : '-'}</span>
                        <span className="text-white bg-gray-800 px-2 py-1 rounded">{Math.abs(breakdown.total)}</span>
                        {result.total !== null && (
                            <>
                                <span className="mx-2 text-yellow-400">=</span>
                                <span className={`text-3xl font-bold ${critClass}`}>{result.total}</span>
                            </>
                        )}
                    </div>
                )}
            </div>
            {result?.total !== null && result.d20 === 20 && (
                <p className="text-sm text-green-400 mb-2">Natural 20</p>
            )}
            {result?.total !== null && result.d20 === 1 && (
                <p className="text-sm text-red-400 mb-2">Natural 1</p>
            )}

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
