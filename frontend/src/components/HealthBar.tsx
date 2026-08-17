import React from 'react';

interface HealthBarProps {
    current: number;
    max: number;
}

const HealthBar: React.FC<HealthBarProps> = ({ current, max }) => {
    const percentage = max > 0 ? (current / max) * 100 : 0;
    
    let barColorClass = 'bg-green-500';
    if (percentage < 50) {
        barColorClass = 'bg-yellow-500';
    }
    if (percentage < 25) {
        barColorClass = 'bg-red-500';
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-1 text-sm">
                <span className="font-bold text-gray-400">Health</span>
                <span className="font-mono">{`${current} / ${max}`}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4">
                <div
                    className={`${barColorClass} h-4 rounded-full transition-all duration-500 ease-out`}
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
        </div>
    );
};

export default HealthBar;
