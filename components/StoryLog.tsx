import React, { useEffect, useRef } from 'react';
import type { ChatMessage } from '../sessionApi/types';

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
                    {msg.role === 'player' ? (
                        <p className="text-right">
                            <span className="inline-block bg-blue-900/50 text-blue-200 rounded-lg px-3 py-2 text-left">
                                &gt; {msg.content}
                            </span>
                        </p>
                    ) : msg.role === 'system' ? (
                         <p className="text-center text-yellow-400 italic my-2">
                            {msg.content}
                        </p>
                    ) : (
                        <p className="text-left">
                           <span className="inline-block bg-gray-800 text-gray-300 rounded-lg px-3 py-2">
                                {msg.content}
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
