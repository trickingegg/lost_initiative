import { useGameStore } from "@/store/gameStore";
import HealthBar from "./HealthBar";

export default function BattleTracker() {
  const battle = useGameStore((s) => s.session?.battle_state ?? null);
  const character = useGameStore((s) => s.session?.character);

  if (!battle || !character) return null;

  const currentTurnId = battle.turn_order[battle.current_turn_index] ?? "";
  const enemies = battle.combatants.filter((c) => !c.is_player);
  const allies = battle.combatants.filter((c) => c.is_player);

  return (
    <div className="w-full bg-red-900/30 border-2 border-red-500/50 rounded-lg p-4 mb-4 shadow-lg">
      <h3 className="text-xl font-bold text-red-300 text-center mb-4 tracking-widest">
        COMBAT — Round {battle.round_number}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold text-gray-300 border-b border-gray-600 pb-1 mb-2">
            Enemies
          </h4>
          <div className="space-y-3">
            {enemies.map((e) => (
              <div key={e.id}>
                <div className="flex justify-between items-baseline">
                  <span className={`font-bold ${
                    currentTurnId === e.id ? "text-amber-400" : "text-gray-200"
                  }`}>
                    {e.name}
                  </span>
                  <span className="text-sm text-gray-400">AC {e.ac}</span>
                </div>
                <HealthBar current={e.hp_current} max={e.hp_max} />
              </div>
            ))}
            {enemies.length === 0 && (
              <p className="text-sm text-gray-500">None</p>
            )}
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-gray-300 border-b border-gray-600 pb-1 mb-2">
            Allies
          </h4>
          <div className="space-y-3">
            {allies.map((a) => (
              <div key={a.id}>
                <div className="flex justify-between items-baseline">
                  <span className={`font-bold ${
                    currentTurnId === a.id ? "text-amber-400" : "text-gray-200"
                  }`}>
                    {a.name}
                  </span>
                  <span className="text-sm text-gray-400">AC {a.ac}</span>
                </div>
                <HealthBar current={a.hp_current} max={a.hp_max} />
              </div>
            ))}
            {allies.length === 0 && (
              <p className="text-sm text-gray-500">None</p>
            )}
          </div>
        </div>
      </div>

      {/* Turn order bar */}
      <div className="mt-4">
        <h4 className="font-semibold text-gray-300 border-b border-gray-600 pb-1 mb-2">
          Turn Order
        </h4>
        <div className="flex flex-wrap gap-2 items-center">
          {battle.turn_order.map((id) => {
            const combatant = battle.combatants.find((c) => c.id === id);
            return (
              <span
                key={id}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  id === currentTurnId
                    ? "bg-amber-500 text-gray-900 font-bold"
                    : "bg-gray-700 text-gray-300"
                }`}
              >
                {combatant?.name ?? id}
              </span>
            );
          })}
          {battle.turn_order.length === 0 && (
            <span className="text-sm text-gray-500">Rolling initiative...</span>
          )}
        </div>
      </div>
    </div>
  );
}
