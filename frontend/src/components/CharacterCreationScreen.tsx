import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "@/store/gameStore";
import { CLASSES, RACES, BACKGROUNDS, ABILITIES } from "@/types/domain";

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export default function CharacterCreationScreen() {
  const navigate = useNavigate();
  const createCharacter = useGameStore((s) => s.createCharacter);
  const isLoading = useGameStore((s) => s.ui.isLoading);
  const error = useGameStore((s) => s.ui.error);

  const [name, setName] = useState("");
  const [charClass, setCharClass] = useState("Fighter");
  const [race, setRace] = useState("Human");
  const [background, setBackground] = useState("Acolyte");
  const [level, setLevel] = useState(1);

  // Standard array assignment per ability
  const [scores, setScores] = useState<Record<string, number>>({
    strength: 15,
    dexterity: 14,
    constitution: 13,
    intelligence: 12,
    wisdom: 10,
    charisma: 8,
  });

  const unusedScores = useMemo(() => {
    const used = Object.values(scores);
    return STANDARD_ARRAY.filter((s) => !used.includes(s));
  }, [scores]);

  const handleScoreChange = (ability: string, newScore: number) => {
    const old = scores[ability];
    // Find which ability currently holds newScore
    const swapped = Object.entries(scores).find(([, v]) => v === newScore)?.[0];
    setScores((prev) => {
      const next = { ...prev, [ability]: newScore };
      if (swapped && swapped !== ability) {
        next[swapped] = old;
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert("Enter a character name.");
    if (unusedScores.length > 0) return alert("Assign all ability scores from standard array.");

    // HP estimate: max hit die + CON mod for level 1
    const conMod = Math.floor((scores.constitution - 10) / 2);
    const hitDieByClass: Record<string, number> = {
      Fighter: 10, Wizard: 6, Rogue: 8, Cleric: 8, Monk: 8, Necromancer: 6,
    };
    const hp = (hitDieByClass[charClass] ?? 8) + conMod;

    await createCharacter({
      name,
      race,
      char_class: charClass,
      background,
      level,
      xp: 0,
      hp_current: hp,
      hp_max: hp,
      speed: 30,
      abilities: {
        strength: scores.strength,
        dexterity: scores.dexterity,
        constitution: scores.constitution,
        intelligence: scores.intelligence,
        wisdom: scores.wisdom,
        charisma: scores.charisma,
      },
      skills: [],
      inventory: [],
    });
    navigate("/setup");
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl bg-gray-800 rounded-lg shadow-xl p-6 space-y-6"
      >
        <h1 className="text-3xl font-bold text-amber-400 text-center">Create Your Hero</h1>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-300 p-3 rounded text-sm">{error}</div>
        )}

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
            required
          />
        </div>

        {/* Race / Class / Background / Level */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Race</label>
            <select
              value={race}
              onChange={(e) => setRace(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3"
            >
              {RACES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Class</label>
            <select
              value={charClass}
              onChange={(e) => setCharClass(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3"
            >
              {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Background</label>
            <select
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3"
            >
              {BACKGROUNDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Starting Level: {level}
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* Ability Scores */}
        <div>
          <h3 className="text-lg font-semibold text-gray-300 mb-2">
            Ability Scores (Standard Array: {STANDARD_ARRAY.join(", ")})
          </h3>
          {unusedScores.length > 0 && (
            <p className="text-sm text-red-400 mb-2">
              Unassigned: {unusedScores.join(", ")}
            </p>
          )}
          <div className="space-y-2">
            {ABILITIES.map((ability) => (
              <div key={ability} className="flex items-center gap-3">
                <span className="w-24 text-sm font-semibold text-gray-400 uppercase">
                  {ability.substring(0, 3)}
                </span>
                <select
                  value={scores[ability]}
                  onChange={(e) => handleScoreChange(ability, Number(e.target.value))}
                  className="bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-center min-w-[60px]"
                >
                  {[scores[ability], ...unusedScores]
                    .sort((a, b) => a - b)
                    .map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                </select>
                <span className="text-amber-400 font-mono text-lg">
                  {Math.floor((scores[ability] - 10) / 2) >= 0 ? "+" : ""}
                  {Math.floor((scores[ability] - 10) / 2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-md transition"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold py-3 px-6 rounded-md transition disabled:opacity-50"
          >
            {isLoading ? "Creating..." : "Begin Adventure"}
          </button>
        </div>
      </form>
    </div>
  );
}
