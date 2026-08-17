import React from 'react';
import { getModifierString } from '../utils/dnd';

interface StatBlockProps {
    label: string;
    score: number;
    modifier: number;
}

const StatBlock: React.FC<StatBlockProps> = ({ label, score, modifier }) => {
    return (
        <div className="bg-gray-800 p-2 rounded text-center">
            <div className="font-bold text-sm text-gray-400">{label}</div>
            <div className="text-xl font-mono">{score}</div>
            <div className="text-yellow-400 font-mono text-sm">{getModifierString(modifier)}</div>
        </div>
    );
};

export default StatBlock;
