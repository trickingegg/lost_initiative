import { create } from "zustand";
import type {
  Character,
  AbilityScores,
  GameSession,
  GMResponse,
  StateChanges,
  StoryTemplate,
  RollRequest,
} from "@/types/domain";
import * as api from "@/api/client";
import { NarrativeStream, type StreamCallbacks } from "@/api/stream";

// ── State shape ──

export type Screen =
  | "menu"
  | "setup"
  | "creation"
  | "game";

export interface UiState {
  screen: Screen;
  isLoading: boolean;
  error: string | null;
  /** Story being progressively streamed */
  streamingText: string;
  /** Suggested actions from GM */
  suggestedActions: string[];
  /** When GM requests a roll */
  awaitingRoll: RollRequest | null;
}

export interface GameStore {
  // ── Data ──
  session: GameSession | null;
  lastGmResponse: GMResponse | null;
  ui: UiState;

  // ── Actions ──
  setScreen: (screen: Screen) => void;
  clearError: () => void;

  /** Create a new session on the backend */
  startSession: (setting: string, storyTemplate: StoryTemplate) => Promise<void>;
  /** Create character via backend (computes AC, spell slots, etc.) */
  createCharacter: (char: Omit<Character, "id" | "proficiency_bonus" | "ac" | "spell_slots" | "death_saves" | "exhaustion" | "features" | "conditions" | "quests" | "spells_known"> & {
    abilities: AbilityScores;
    skills: string[];
  }) => Promise<void>;
  /** Send player action via REST */
  sendAction: (action: string) => Promise<void>;
  /** Submit roll result */
  submitRoll: (roll: number) => Promise<void>;
  /** Take a rest */
  takeRest: (type: "short" | "long", hitDiceSpent?: number) => Promise<void>;
  /** Save/load slots */
  saveGame: (slot: number) => Promise<void>;
  loadGame: (slot: number) => Promise<void>;

  /** Start WebSocket streaming for narrative */
  startStreaming: (action: string) => void;
  /** Stop WebSocket */
  stopStreaming: () => void;

  /** Apply state changes from backend to local session */
  applyStateChanges: (changes: StateChanges) => void;

  /** Compute derived stats client-side */
  computeModifier: (score: number) => number;
}

// ── Helpers ──

function modifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

// ── Store ──

let stream: NarrativeStream | null = null;

export const useGameStore = create<GameStore>((set, get) => ({
  session: null,
  lastGmResponse: null,
  ui: {
    screen: "menu",
    isLoading: false,
    error: null,
    streamingText: "",
    suggestedActions: [],
    awaitingRoll: null,
  },

  setScreen: (screen) => set((s) => ({ ui: { ...s.ui, screen } })),
  clearError: () => set((s) => ({ ui: { ...s.ui, error: null } })),

  startSession: async (setting, storyTemplate) => {
    const state = get();
    if (!state.session) throw new Error("No character created");
    set((s) => ({ ui: { ...s.ui, isLoading: true, error: null } }));
    try {
      const resp = await api.createSession({
        character: state.session!.character,
        setting,
        story_template: storyTemplate,
      });
      set({
        session: resp.session,
        ui: { ...get().ui, isLoading: false, screen: "game" },
      });
    } catch (e) {
      set((s) => ({
        ui: { ...s.ui, isLoading: false, error: String(e) },
      }));
    }
  },

  createCharacter: async (char) => {
    set((s) => ({ ui: { ...s.ui, isLoading: true, error: null } }));
    try {
      // Build a temporary Character to send to the backend
      const temp: Character = {
        id: crypto.randomUUID(),
        name: char.name,
        race: char.race,
        char_class: char.char_class,
        background: char.background,
        level: char.level,
        xp: char.xp,
        hp_current: char.hp_current,
        hp_max: char.hp_max,
        ac: 0, // backend computes
        speed: char.speed,
        abilities: char.abilities,
        proficiency_bonus: 2,
        skills: char.skills,
        features: [],
        inventory: [],
        spells_known: [],
        spell_slots: {},
        conditions: [],
        death_saves: { successes: 0, failures: 0 },
        exhaustion: 0,
        quests: [],
      };
      const created = await api.createCharacter(temp);
      set({
        session: {
          id: crypto.randomUUID(),
          character: created,
          setting: "",
          story_template: "dungeon_delve",
          chat_history: [],
          battle_state: null,
          world_events: [],
          gm_internal_notes: "",
          images_cache: {},
          turn_count: 0,
          memory_events: [],
        },
        ui: { ...get().ui, isLoading: false, screen: "setup" },
      });
    } catch (e) {
      set((s) => ({
        ui: { ...s.ui, isLoading: false, error: String(e) },
      }));
    }
  },

  sendAction: async (action) => {
    const session = get().session;
    if (!session) return;
    set((s) => ({ ui: { ...s.ui, isLoading: true, error: null } }));
    try {
      const resp = await api.playerAction(session.id, action);
      set({
        session: resp.session,
        lastGmResponse: resp.gm_response,
        ui: {
          ...get().ui,
          isLoading: false,
          suggestedActions: resp.gm_response.suggested_actions,
          awaitingRoll: resp.gm_response.state_changes.await_roll ?? null,
        },
      });
    } catch (e) {
      set((s) => ({
        ui: { ...s.ui, isLoading: false, error: String(e) },
      }));
    }
  },

  submitRoll: async (roll) => {
    const session = get().session;
    if (!session) return;
    set((s) => ({ ui: { ...s.ui, isLoading: true, error: null, awaitingRoll: null } }));
    try {
      const resp = await api.submitRoll(session.id, roll);
      set({
        session: resp.session,
        lastGmResponse: resp.gm_response,
        ui: {
          ...get().ui,
          isLoading: false,
          suggestedActions: resp.gm_response.suggested_actions,
          awaitingRoll: resp.gm_response.state_changes.await_roll ?? null,
        },
      });
    } catch (e) {
      set((s) => ({
        ui: { ...s.ui, isLoading: false, error: String(e) },
      }));
    }
  },

  takeRest: async (type, hitDiceSpent = 0) => {
    const session = get().session;
    if (!session) return;
    set((s) => ({ ui: { ...s.ui, isLoading: true, error: null } }));
    try {
      const resp = await api.takeRest(session.id, { type, hit_dice_spent: hitDiceSpent });
      set({
        session: resp.session,
        lastGmResponse: resp.gm_response,
        ui: { ...get().ui, isLoading: false },
      });
    } catch (e) {
      set((s) => ({
        ui: { ...s.ui, isLoading: false, error: String(e) },
      }));
    }
  },

  saveGame: async (slot) => {
    const session = get().session;
    if (!session) return;
    try {
      await api.saveGame(session.id, slot);
    } catch (e) {
      set((s) => ({ ui: { ...s.ui, error: String(e) } }));
    }
  },

  loadGame: async (slot) => {
    const session = get().session;
    if (!session) return;
    set((s) => ({ ui: { ...s.ui, isLoading: true, error: null } }));
    try {
      const resp = await api.loadGame(session.id, slot);
      set({
        session: resp.session,
        lastGmResponse: resp.last_gm_response,
        ui: { ...get().ui, isLoading: false },
      });
    } catch (e) {
      set((s) => ({
        ui: { ...s.ui, isLoading: false, error: String(e) },
      }));
    }
  },

  startStreaming: (action) => {
    const session = get().session;
    if (!session) return;

    // Stop existing stream
    stream?.disconnect();

    set((s) => ({
      ui: { ...s.ui, streamingText: "", isLoading: true, error: null },
    }));

    let fullText = "";

    const callbacks: StreamCallbacks = {
      onChunk: (text) => {
        fullText += text;
        set((s) => ({
          ui: { ...s.ui, streamingText: fullText },
        }));
      },
      onStateChanges: (changes) => {
        get().applyStateChanges(changes);
        set((s) => ({
          ui: {
            ...s.ui,
            awaitingRoll: changes.await_roll ?? null,
          },
        }));
      },
      onSuggestedActions: (actions) => {
        set((s) => ({
          ui: { ...s.ui, suggestedActions: actions },
        }));
      },
      onDone: () => {
        set((s) => ({
          ui: { ...s.ui, isLoading: false },
        }));
      },
      onError: (msg) => {
        set((s) => ({
          ui: { ...s.ui, isLoading: false, error: msg },
        }));
      },
    };

    stream = new NarrativeStream(session.id, callbacks);
    stream.connect();

    // Small delay to let WS connect
    setTimeout(() => stream?.send(action), 100);
  },

  stopStreaming: () => {
    stream?.disconnect();
    stream = null;
    set((s) => ({
      ui: { ...s.ui, isLoading: false },
    }));
  },

  applyStateChanges: (changes) => {
    set((s) => {
      if (!s.session) return s;
      const char = { ...s.session.character };

      if (changes.damage) {
        char.hp_current = Math.max(0, char.hp_current - changes.damage);
      }
      if (changes.heal) {
        char.hp_current = Math.min(char.hp_max, char.hp_current + changes.heal);
      }
      if (changes.add_xp) {
        char.xp += changes.add_xp;
      }
      if (changes.set_condition && !char.conditions.includes(changes.set_condition)) {
        char.conditions = [...char.conditions, changes.set_condition];
      }
      if (changes.clear_condition) {
        char.conditions = char.conditions.filter((c) => c !== changes.clear_condition);
      }
      if (changes.cast_spell) {
        const level: number = (changes.cast_spell as Record<string, unknown>).level as number ?? 1;
        if (char.spell_slots[level] && char.spell_slots[level].current > 0) {
          char.spell_slots = {
            ...char.spell_slots,
            [level]: { ...char.spell_slots[level], current: char.spell_slots[level].current - 1 },
          };
        }
      }
      if (changes.use_ki && char.ki_current != null) {
        char.ki_current = Math.max(0, char.ki_current - changes.use_ki);
      }
      if (changes.exhaustion_change != null) {
        char.exhaustion = Math.max(0, char.exhaustion + changes.exhaustion_change);
      }

      // Battle updates
      let battle = s.session.battle_state;
      if (changes.start_battle) {
        const combatants = (changes.start_battle as unknown[]).map((enemy, i) => {
          const e = enemy as Record<string, unknown>;
          return {
            id: `enemy-${i}`,
            name: e.name as string ?? "Enemy",
            hp_current: e.hp as number ?? 10,
            hp_max: e.hp as number ?? 10,
            ac: e.ac as number ?? 10,
            initiative: 0,
            initiative_bonus: e.initiative_bonus as number ?? 0,
            cr: e.cr as number ?? 0,
            is_player: false,
          };
        });
        battle = {
          combatants: [
            ...combatants,
            {
              id: "player",
              name: char.name,
              hp_current: char.hp_current,
              hp_max: char.hp_max,
              ac: char.ac,
              initiative: 0,
              initiative_bonus: modifier(char.abilities.dexterity),
              cr: 0,
              is_player: true,
            },
          ],
          turn_order: [],
          current_turn_index: 0,
          round_number: 1,
        };
      }
      if (changes.end_battle) {
        battle = null;
      }

      return {
        ...s,
        session: {
          ...s.session,
          character: char,
          battle_state: battle,
          turn_count: s.session.turn_count + 1,
        },
      };
    });
  },

  computeModifier: (score) => modifier(score),
}));
