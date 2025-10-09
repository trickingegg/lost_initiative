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
                <div key={index} className="mb-4">
                    {msg.sender === 'player' ? (
                        <p className="text-right">
                            <span className="inline-block bg-blue-900/50 text-blue-200 rounded-lg px-3 py-2 text-left">
                                &gt; {msg.text}
                            </span>
                        </p>
                    ) : msg.sender === 'system' ? (
                         <p className="text-center text-yellow-400 italic my-2">
                            {msg.text}
                        </p>
                    ) : (
                        <p className="text-left">
                           <span className="inline-block bg-gray-800 text-gray-300 rounded-lg px-3 py-2">
                                {msg.text}
                            </span>
                        </p>
                    )}
                </div>
            ))}
            <div ref={logEndRef} />
        </div>
    );
};

export default StoryLog;