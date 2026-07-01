import { useState } from "react";
import { useGameStore } from "@/store/gameStore";

export default function DiceRollPrompt() {
  const awaitingRoll = useGameStore((s) => s.ui.awaitingRoll);
  const submitRoll = useGameStore((s) => s.submitRoll);
  const character = useGameStore((s) => s.session?.character);
  const computeModifier = useGameStore((s) => s.computeModifier);
  const isLoading = useGameStore((s) => s.ui.isLoading);

  const [isRolling, setIsRolling] = useState(false);
  const [result, setResult] = useState<{ d20: number; modifier: number; total: number | null } | null>(null);

  if (!awaitingRoll || !character) return null;

  const mod = computeModifier(
    character.abilities[awaitingRoll.ability as keyof typeof character.abilities] ?? 10
  );

  const handleRoll = () => {
    setIsRolling(true);
    setResult(null);

    let count = 0;
    const anim = setInterval(() => {
      setResult({ d20: Math.floor(Math.random() * 20) + 1, modifier: mod, total: null });
      count++;
      if (count >= 10) {
        clearInterval(anim);
        const d20 = Math.floor(Math.random() * 20) + 1;
        const total = d20 + mod;
        setResult({ d20, modifier: mod, total });

        setTimeout(() => submitRoll(total), 1500);
      }
    }, 100);
  };

  return (
    <div className="w-full bg-gray-700 border border-amber-500/50 rounded-lg p-4 text-center shadow-lg">
      <h3 className="text-lg font-semibold text-amber-400 mb-2">Roll Required</h3>
      <p className="text-gray-300 mb-4">
        {awaitingRoll.type.replace("_", " ")} — {awaitingRoll.ability} (DC {awaitingRoll.dc})
      </p>

      <div className="h-20 flex items-center justify-center">
        {result && (
          <div className="text-2xl font-mono">
            <span className="text-white bg-gray-800 px-2 py-1 rounded">{result.d20}</span>
            <span className="mx-2 text-amber-400">{mod >= 0 ? "+" : ""}{mod}</span>
            {result.total !== null && (
              <>
                <span className="mx-2 text-amber-400">=</span>
                <span className={`text-3xl font-bold ${
                  result.total >= awaitingRoll.dc ? "text-green-400" : "text-red-400"
                }`}>
                  {result.total}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <button
        onClick={handleRoll}
        disabled={isRolling || isLoading}
        className="bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold py-2 px-6 rounded-md transition duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed"
      >
        {isRolling ? "Rolling..." : "Roll d20"}
      </button>
    </div>
  );
}
