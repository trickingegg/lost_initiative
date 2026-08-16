import React, { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../api/types';

interface StoryLogProps {
    chatHistory: ChatMessage[];
    isThinking?: boolean;
}

const StoryLog: React.FC<StoryLogProps> = ({ chatHistory, isThinking }) => {
    const logEndRef = useRef<HTMLDivElement>(null);
    const [typedLength, setTypedLength] = useState(Number.MAX_SAFE_INTEGER);
    const lastGmKey = useRef<string>('');

    const lastGmIndex = (() => {
        for (let i = chatHistory.length - 1; i >= 0; i -= 1) {
            if (chatHistory[i].role === 'gm') {
                return i;
            }
        }
        return -1;
    })();

    useEffect(() => {
        if (lastGmIndex < 0) {
            return;
        }
        const message = chatHistory[lastGmIndex];
        const key = `${lastGmIndex}:${message.content}`;
        if (lastGmKey.current === key) {
            return;
        }
        lastGmKey.current = key;
        setTypedLength(0);
        let current = 0;
        const timer = window.setInterval(() => {
            current += 3;
            if (current >= message.content.length) {
                setTypedLength(message.content.length);
                window.clearInterval(timer);
            } else {
                setTypedLength(current);
            }
        }, 16);
        return () => window.clearInterval(timer);
    }, [chatHistory, lastGmIndex]);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, typedLength, isThinking]);

    return (
        <div className="flex-grow min-h-0 bg-gray-900 p-4 rounded-lg overflow-y-auto font-mono text-sm leading-6">
            {chatHistory.map((msg, index) => {
                const content = index === lastGmIndex ? msg.content.slice(0, typedLength) : msg.content;
                return (
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
                                    {content}
                                    {index === lastGmIndex && typedLength < msg.content.length ? '▍' : ''}
                                </span>
                            </p>
                        )}
                    </div>
                );
            })}
            {isThinking && (
                <p className="text-left mb-4 text-yellow-500 italic">The Game Master is thinking...</p>
            )}
            <div ref={logEndRef} />
        </div>
    );
};

export default StoryLog;
