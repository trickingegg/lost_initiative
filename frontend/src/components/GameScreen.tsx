import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import CharacterSheet from "./CharacterSheet";
import StoryLog from "./StoryLog";
import DiceRollPrompt from "./DiceRollPrompt";
import BattleTracker from "./BattleTracker";

const HIT_DIE_BY_CLASS: Record<string, number> = {
  fighter: 10, wizard: 6, rogue: 8, cleric: 8, monk: 8,
  necromancer: 6, barbarian: 12, paladin: 10, ranger: 10,
  sorcerer: 6, warlock: 8, bard: 8, druid: 8,
};

export default function GameScreen() {
  const session = useGameStore((s) => s.session);
  const character = useGameStore((s) => s.session?.character);
  const chatHistory = useGameStore((s) => s.session?.chat_history ?? []);
  const isLoading = useGameStore((s) => s.ui.isLoading);
  const streamingText = useGameStore((s) => s.ui.streamingText);
  const suggestedActions = useGameStore((s) => s.ui.suggestedActions);
  const awaitingRoll = useGameStore((s) => s.ui.awaitingRoll);
  const error = useGameStore((s) => s.ui.error);

  const takeRest = useGameStore((s) => s.takeRest);
  const saveGame = useGameStore((s) => s.saveGame);
  const loadGame = useGameStore((s) => s.loadGame);
  const startStreaming = useGameStore((s) => s.startStreaming);

  const [input, setInput] = useState("");
  const [showShortRest, setShowShortRest] = useState(false);
  const [hitDiceToSpend, setHitDiceToSpend] = useState(1);

  const battle = session?.battle_state ?? null;

  const maxHitDice = character?.level ?? 1;
  const conMod = character
    ? Math.floor((character.abilities.constitution - 10) / 2)
    : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || awaitingRoll) return;
    startStreaming(input.trim());
    setInput("");
  };

  const handleLongRest = async () => {
    if (!session) return;
    await takeRest("long");
  };

  const doShortRest = async () => {
    if (!session) return;
    await takeRest("short", hitDiceToSpend);
    setShowShortRest(false);
  };

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row bg-gray-800 text-gray-200 overflow-hidden">
      {/* Main */}
      <main className="flex-1 flex flex-col h-full p-4 overflow-hidden">
        {/* Header bar */}
        <div className="flex-shrink-0 mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-amber-400 truncate">
            {character?.name ?? "Adventure"} — {session?.setting}
          </h1>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setShowShortRest(true)}
              disabled={isLoading}
              className="bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold py-2 px-3 rounded transition disabled:opacity-50"
            >
              Short Rest
            </button>
            <button
              onClick={handleLongRest}
              disabled={isLoading}
              className="bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold py-2 px-3 rounded transition disabled:opacity-50"
            >
              Long Rest
            </button>
            <button
              onClick={() => saveGame(1)}
              disabled={isLoading || !session}
              className="bg-gray-600 hover:bg-gray-500 text-white text-xs font-bold py-2 px-3 rounded transition disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => loadGame(1)}
              disabled={isLoading || !session}
              className="bg-gray-600 hover:bg-gray-500 text-white text-xs font-bold py-2 px-3 rounded transition disabled:opacity-50"
            >
              Load
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-3 bg-red-900/50 border border-red-500 text-red-300 p-2 rounded text-xs">
            {error}
          </div>
        )}

        {battle && <BattleTracker />}

        <StoryLog messages={chatHistory} streamingText={streamingText} />

        {/* Input area */}
        <div className="mt-4 flex-shrink-0">
          {awaitingRoll ? (
            <DiceRollPrompt />
          ) : (
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="What do you do?"
                className="flex-grow bg-gray-700 border border-gray-600 rounded-md py-2 px-4 focus:outline-none focus:ring-2 focus:ring-amber-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold py-2 px-5 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </form>
          )}

          {/* Suggested actions */}
          {suggestedActions.length > 0 && !awaitingRoll && (
            <div className="flex flex-wrap gap-2 mt-2">
              {suggestedActions.map((action) => (
                <button
                  key={action}
                  onClick={() => {
                    startStreaming(action);
                  }}
                  disabled={isLoading}
                  className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 py-1 px-3 rounded-full transition disabled:opacity-50"
                >
                  {action}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Sidebar */}
      <aside className="w-full md:w-80 lg:w-96 bg-gray-900 p-4 overflow-y-auto h-full flex-shrink-0 border-l-2 border-gray-700">
        <CharacterSheet />
      </aside>

      {/* Short Rest Dialog */}
      {showShortRest && character && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-80 shadow-xl border border-gray-600">
            <h3 className="text-lg font-bold text-amber-400 mb-4">Short Rest</h3>
            <p className="text-sm text-gray-400 mb-3">
              Spend Hit Dice to recover HP. You have <strong className="text-white">{maxHitDice}</strong> hit dice available.
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Hit Die: d{HIT_DIE_BY_CLASS[character.char_class.toLowerCase()] ?? 8} + CON ({conMod >= 0 ? "+" : ""}{conMod})
            </p>
            <label className="block mb-4">
              <span className="text-sm text-gray-400">Hit Dice to spend:</span>
              <input
                type="range"
                min={0}
                max={maxHitDice}
                value={hitDiceToSpend}
                onChange={(e) => setHitDiceToSpend(Number(e.target.value))}
                className="w-full mt-1 accent-amber-400"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0</span>
                <span className="text-amber-400 font-bold">{hitDiceToSpend}</span>
                <span>{maxHitDice}</span>
              </div>
            </label>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowShortRest(false)}
                className="bg-gray-600 hover:bg-gray-500 text-white text-xs font-bold py-2 px-4 rounded transition"
              >
                Cancel
              </button>
              <button
                onClick={doShortRest}
                disabled={isLoading}
                className="bg-amber-500 hover:bg-amber-600 text-gray-900 text-xs font-bold py-2 px-4 rounded transition disabled:opacity-50"
              >
                Rest ({hitDiceToSpend} HD)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
