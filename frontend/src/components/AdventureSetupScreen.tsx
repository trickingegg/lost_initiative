import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "@/store/gameStore";
import { STORY_TEMPLATES } from "@/types/domain";
import type { StoryTemplate } from "@/types/domain";

export default function AdventureSetupScreen() {
  const navigate = useNavigate();
  const startSession = useGameStore((s) => s.startSession);
  const isLoading = useGameStore((s) => s.ui.isLoading);
  const error = useGameStore((s) => s.ui.error);

  const [setting, setSetting] = useState("Classic Fantasy");
  const [customSetting, setCustomSetting] = useState("");
  const [storyTemplate, setStoryTemplate] = useState<StoryTemplate>("dungeon_delve");

  const handleStart = async () => {
    const finalSetting = setting === "Custom" ? customSetting.trim() : setting;
    if (!finalSetting) return alert("Describe your setting.");
    await startSession(finalSetting, storyTemplate);
    navigate("/game");
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-gray-800 rounded-lg shadow-xl p-8">
        <h1 className="text-3xl font-bold text-amber-400 text-center mb-6">Setup Your Adventure</h1>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-300 p-3 rounded text-sm mb-4">{error}</div>
        )}

        {/* Story template */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">Story Template</label>
          <div className="grid grid-cols-2 gap-3">
            {STORY_TEMPLATES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setStoryTemplate(t.value)}
                className={`p-3 rounded border text-left transition ${
                  storyTemplate === t.value
                    ? "border-amber-500 bg-gray-700/50"
                    : "border-gray-700 hover:border-gray-600"
                }`}
              >
                <div className="font-bold text-sm">{t.label}</div>
                <div className="text-xs text-gray-400 mt-1">{t.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Settings */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">Setting</label>
          <div className="grid grid-cols-3 gap-3">
            {["Classic Fantasy", "Dark Fantasy", "Cyberpunk", "Cosmic Horror", "Post-Apocalyptic", "Steampunk", "Custom"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSetting(s)}
                className={`p-3 rounded border text-center text-sm transition ${
                  setting === s ? "border-amber-500 bg-gray-700/50" : "border-gray-700 hover:border-gray-600"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {setting === "Custom" && (
            <textarea
              value={customSetting}
              onChange={(e) => setCustomSetting(e.target.value)}
              placeholder="Describe your world..."
              className="w-full mt-3 h-20 bg-gray-700 border border-gray-600 rounded-md py-2 px-3"
            />
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate("/create")}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-md transition"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={isLoading}
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold py-3 rounded-md transition disabled:opacity-50"
          >
            {isLoading ? "Starting..." : "Start Adventure"}
          </button>
        </div>
      </div>
    </div>
  );
}
