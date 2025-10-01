import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../types';

interface StoryLogProps {
    chatHistory: ChatMessage[];
}

const StoryLog: React.FC<StoryLogProps> = ({ chatHistory }) => {
    const logEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    return (
        <div className="flex-grow bg-gray-900 p-4 rounded-lg overflow-y-auto font-mono text-sm leading-6">
            {chatHistory.map((msg, index) => (
                <div key={index} className={`mb-4 ${msg.sender === 'player' ? 'text-right' : 'text-left'}`}>
                    {msg.sender === 'player' ? (
                        <p className="inline-block bg-blue-900/50 text-blue-200 rounded-lg px-3 py-2 text-left">
                           > {msg.text}
                        </p>
                    ) : (
                        <p className="inline-block bg-gray-800 text-gray-300 rounded-lg px-3 py-2">
                            {msg.text}
                        </p>
                    )}
                </div>
            ))}
            <div ref={logEndRef} />
        </div>
    );
};

export default StoryLog;
