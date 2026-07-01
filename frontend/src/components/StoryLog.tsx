import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/types/domain";

interface StoryLogProps {
  messages: ChatMessage[];
  /** Text being streamed in right now (WebSocket chunks) */
  streamingText?: string;
}

export default function StoryLog({ messages, streamingText }: StoryLogProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  return (
    <div className="flex-grow bg-gray-900 p-4 rounded-lg overflow-y-auto font-mono text-sm leading-6">
      {messages.map((msg, i) => (
        <div key={i} className="mb-4">
          {msg.role === "player" ? (
            <p className="text-right">
              <span className="inline-block bg-blue-900/50 text-blue-200 rounded-lg px-3 py-2 text-left max-w-[80%]">
                &gt; {msg.content}
              </span>
            </p>
          ) : msg.role === "system" ? (
            <p className="text-center text-amber-400 italic my-2">{msg.content}</p>
          ) : (
            <p className="text-left">
              <span className="inline-block bg-gray-800 text-gray-300 rounded-lg px-3 py-2 max-w-[85%]">
                {msg.content}
              </span>
            </p>
          )}
        </div>
      ))}

      {/* Streaming preview */}
      {streamingText && (
        <div className="mb-4">
          <p className="text-left">
            <span className="inline-block bg-gray-800 text-gray-300 rounded-lg px-3 py-2 max-w-[85%] border-l-2 border-amber-400 animate-pulse">
              {streamingText}
            </span>
          </p>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
