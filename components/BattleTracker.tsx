import React from 'react';
import type { BattleState } from '../api/types';
import HealthBar from './HealthBar';

interface BattleTrackerProps {
    battle: BattleState;
}

const BattleTracker: React.FC<BattleTrackerProps> = ({ battle }) => {
    const currentTurnId = battle.turn_order[battle.current_turn_index];
    const enemies = battle.combatants.filter((combatant) => !combatant.is_player);
    const nameById = Object.fromEntries(battle.combatants.map((combatant) => [combatant.id, combatant.name]));

    return (
        <div className="w-full bg-red-900/30 border-2 border-red-500/50 rounded-lg p-4 mb-4 shadow-lg">
            <h3 className="text-xl font-bold text-red-300 text-center mb-4 tracking-widest">COMBAT</h3>

            <div className="space-y-3 mb-4">
                {enemies.map((enemy) => (
                    <div key={enemy.id}>
                        <div className="flex justify-between items-baseline">
                            <span className={`font-bold ${currentTurnId === enemy.id ? 'text-yellow-400' : 'text-gray-200'}`}>{enemy.name}</span>
                            <span className="text-sm text-gray-400">AC: {enemy.ac} · id: {enemy.id}</span>
                        </div>
                        <HealthBar current={enemy.hp_current} max={enemy.hp_max} />
                    </div>
                ))}
                {enemies.length === 0 && <p className="text-sm text-gray-500">No enemies remain.</p>}
            </div>

            <div className="mt-4">
                <h4 className="font-semibold text-gray-300 border-b border-gray-600 pb-1 mb-2">Turn Order</h4>
                <div className="flex flex-wrap gap-2 items-center">
                    {battle.turn_order.map((id) => {
                        const name = id === 'player' ? 'Player' : (nameById[id] || 'Unknown');
                        const isCurrentTurn = id === currentTurnId;
                        return (
                            <span key={id} className={`px-3 py-1 text-sm rounded-full ${isCurrentTurn ? 'bg-yellow-500 text-gray-900 font-bold' : 'bg-gray-700 text-gray-300'}`}>
                                {name}
                            </span>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default BattleTracker;
