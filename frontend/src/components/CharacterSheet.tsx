import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import HealthBar from "./HealthBar";
import StatBlock from "./StatBlock";

const ABILITY_LABELS: Record<string, string> = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
};

type Tab = "Inventory" | "Spells" | "Features" | "Quests" | "Conditions";

const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

export default function CharacterSheet() {
  const character = useGameStore((s) => s.session?.character ?? null);
  const computeModifier = useGameStore((s) => s.computeModifier);
  const [activeTab, setActiveTab] = useState<Tab>("Inventory");

  if (!character) {
    return (
      <div className="flex flex-col h-full text-gray-300 items-center justify-center">
        <p className="text-gray-500">No character loaded</p>
      </div>
    );
  }

  const xpForNext = character.level < XP_THRESHOLDS.length
    ? XP_THRESHOLDS[character.level]
    : character.xp;

  return (
    <div className="flex flex-col h-full text-gray-300 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-amber-400 truncate">{character.name}</h2>
        <p className="text-gray-400">
          Level {character.level} {character.race} {character.subclass ?? character.char_class}
        </p>
        <p className="text-sm text-gray-500">XP: {character.xp} / {xpForNext}</p>
      </div>

      {/* HP + AC + Speed */}
      <HealthBar current={character.hp_current} max={character.hp_max} />

      {character.ki_max != null && character.ki_current != null && (
        <div>
          <div className="flex justify-between items-center mb-1 text-sm">
            <span className="font-bold text-gray-400">Ki Points</span>
            <span className="font-mono">{character.ki_current} / {character.ki_max}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className="bg-cyan-400 h-3 rounded-full transition-all duration-500"
              style={{ width: `${(character.ki_current / character.ki_max) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* AC / Speed / Prof */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-800 p-2 rounded">
          <div className="font-bold text-xs text-gray-400">AC</div>
          <div className="text-xl font-mono">{character.ac}</div>
        </div>
        <div className="bg-gray-800 p-2 rounded">
          <div className="font-bold text-xs text-gray-400">Speed</div>
          <div className="text-xl font-mono">{character.speed}ft</div>
        </div>
        <div className="bg-gray-800 p-2 rounded">
          <div className="font-bold text-xs text-gray-400">Prof</div>
          <div className="text-xl font-mono text-amber-400">+{character.proficiency_bonus}</div>
        </div>
      </div>

      {/* Abilities */}
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(character.abilities).map(([key, score]) => (
          <StatBlock
            key={key}
            label={ABILITY_LABELS[key] ?? key}
            score={score}
            modifier={computeModifier(score)}
          />
        ))}
      </div>

      {/* Death saves (shown when HP = 0) */}
      {character.hp_current === 0 && (
        <div className="bg-red-900/40 p-3 rounded border border-red-700">
          <div className="text-sm font-bold text-red-400 mb-1">Death Saves</div>
          <div className="flex gap-4 text-sm">
            <span className="text-green-400">
              Successes: {character.death_saves.successes}/3
            </span>
            <span className="text-red-400">
              Failures: {character.death_saves.failures}/3
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex-grow flex flex-col min-h-0">
        <div className="border-b border-gray-700 flex">
          {(["Inventory", "Spells", "Features", "Quests", "Conditions"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-3 text-xs font-medium transition-colors ${
                activeTab === tab
                  ? "border-b-2 border-amber-400 text-amber-400"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="bg-gray-800 rounded-b p-3 flex-grow overflow-y-auto">
          {activeTab === "Inventory" && (
            <ul className="space-y-2 text-sm">
              {character.inventory.length > 0 ? (
                character.inventory.map((item) => (
                  <li key={item.name} className="flex justify-between">
                    <span>{item.name}</span>
                    <span className="text-gray-400">x{item.quantity}</span>
                  </li>
                ))
              ) : (
                <li className="text-gray-500 italic">No items.</li>
              )}
            </ul>
          )}

          {activeTab === "Spells" && (
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold text-gray-400 border-b border-gray-700 pb-1 mb-2">
                  Spell Slots
                </h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(character.spell_slots).length > 0 ? (
                    Object.entries(character.spell_slots).map(([level, slot]) => (
                      <div key={level} className="text-center bg-gray-900 p-2 rounded min-w-[48px]">
                        <div className="text-xs text-gray-500">L{level}</div>
                        <div className="font-mono text-lg">{slot.current}/{slot.maximum}</div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-xs">No spell slots.</p>
                  )}
                </div>
              </div>
              <ul className="space-y-1">
                {character.spells_known.length > 0 ? (
                  character.spells_known.map((name) => (
                    <li key={name} className="py-1 font-semibold">{name}</li>
                  ))
                ) : (
                  <li className="text-gray-500 italic">No spells known.</li>
                )}
              </ul>
            </div>
          )}

          {activeTab === "Features" && (
            <ul className="space-y-3 text-sm">
              {character.features.length > 0 ? (
                character.features.map((f) => (
                  <li key={f.name}>
                    <p className="font-semibold">{f.name}</p>
                    <p className="text-xs text-gray-400">{f.description}</p>
                  </li>
                ))
              ) : (
                <li className="text-gray-500 italic">No features.</li>
              )}
            </ul>
          )}

          {activeTab === "Quests" && (
            <ul className="space-y-3 text-sm">
              {character.quests.length > 0 ? (
                character.quests.map((q) => (
                  <li key={q.title}>
                    <p className="font-semibold">
                      {q.title}
                      {q.status !== "active" && (
                        <span className="text-xs ml-1 text-gray-500">({q.status})</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">{q.description}</p>
                  </li>
                ))
              ) : (
                <li className="text-gray-500 italic">No quests.</li>
              )}
            </ul>
          )}

          {activeTab === "Conditions" && (
            <ul className="space-y-2 text-sm">
              {character.conditions.length > 0 ? (
                character.conditions.map((c) => (
                  <li key={c} className="bg-red-900/30 px-2 py-1 rounded text-red-300 font-mono text-xs">
                    {c}
                  </li>
                ))
              ) : (
                <li className="text-gray-500 italic">No active conditions.</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
