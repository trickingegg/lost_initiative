import React from 'react';
import { BattleState } from '../types';
import HealthBar from './HealthBar';

interface BattleTrackerProps {
    battle: BattleState;
}

const BattleTracker: React.FC<BattleTrackerProps> = ({ battle }) => {
    const currentTurnId = battle.turnOrder[battle.currentTurnIndex];

    return (
        <div className="w-full bg-red-900/30 border-2 border-red-500/50 rounded-lg p-4 mb-4 shadow-lg animate-fade-in">
             <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
            `}</style>
            <h3 className="text-xl font-bold text-red-300 text-center mb-4 tracking-widest">COMBAT</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <h4 className="font-semibold text-gray-300 border-b border-gray-600 pb-1 mb-2">Enemies</h4>
                    <div className="space-y-3">
                        {battle.enemies.map(enemy => (
                            <div key={enemy.id}>
                                <div className="flex justify-between items-baseline">
                                    <span className={`font-bold ${currentTurnId === enemy.id ? 'text-yellow-400' : 'text-gray-200'}`}>{enemy.name}</span>
                                    <span className="text-sm text-gray-400">AC: {enemy.ac}</span>
                                </div>
                                <HealthBar current={enemy.hp.current} max={enemy.hp.max} />
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <h4 className="font-semibold text-gray-300 border-b border-gray-600 pb-1 mb-2">Allies</h4>
                    <div className="space-y-3">
                        {battle.allies && battle.allies.length > 0 ? battle.allies.map(ally => (
                            <div key={ally.id}>
                                <div className="flex justify-between items-baseline">
                                    <span className={`font-bold ${currentTurnId === ally.id ? 'text-yellow-400' : 'text-gray-200'}`}>{ally.name}</span>
                                    <span className="text-sm text-gray-400">AC: {ally.ac}</span>
                                </div>
                                <HealthBar current={ally.hp.current} max={ally.hp.max} />
                            </div>
                        )) : <p className="text-sm text-gray-500">None</p>}
                    </div>
                </div>
            </div>


             <div className="mt-4">
                <h4 className="font-semibold text-gray-300 border-b border-gray-600 pb-1 mb-2">Turn Order</h4>
                <div className="flex flex-wrap gap-2 items-center">
                    {battle.turnOrder.map(id => {
                        const isPlayer = id === 'player';
                        const enemy = battle.enemies.find(e => e.id === id);
                        const ally = battle.allies?.find(a => a.id === id);
                        const name = isPlayer ? "Player" : (enemy?.name || ally?.name || 'Unknown');
                        const isCurrentTurn = id === currentTurnId;
                        return (
                            <span key={id} className={`px-3 py-1 text-sm rounded-full transition-colors duration-300 ${isCurrentTurn ? 'bg-yellow-500 text-gray-900 font-bold' : 'bg-gray-700 text-gray-300'}`}>
                                {name}
                            </span>
                        )
                    })}
                </div>
            </div>

        </div>
    );
};

export default BattleTracker;