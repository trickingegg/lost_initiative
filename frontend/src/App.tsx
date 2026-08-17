import React, { useCallback, useEffect, useRef, useState } from 'react';
import MainMenuScreen from './components/MainMenuScreen';
import SettingsScreen from './components/SettingsScreen';
import AdventureSetupScreen from './components/AdventureSetupScreen';
import CharacterCreationScreen from './components/CharacterCreationScreen';
import GameScreen from './components/GameScreen';
import { Character as FormCharacter } from './types';
import {
  ApiError,
  checkHealth,
  createCharacter,
  getSession,
  listSaves,
  loadSlot,
  postAction,
  postRest,
  postRoll,
  saveSlot,
  startSession,
} from './api/client';
import { toApiCharacter } from './api/mappers';
import { GameSession, GMResponse, SaveSlotInfo, StoryTemplate } from './api/types';

type Screen = 'menu' | 'settings' | 'setup' | 'creation' | 'game';

const TEMPERATURE_KEY = 'ai-gm-temperature';
const SESSION_KEY = 'ai-gm-session-id';
const DEFAULT_TEMPERATURE = 0.7;
const OPENING_ACTION =
  'The adventure begins. Describe my starting location and situation.';

function readTemperature(): number {
  try {
    const saved = localStorage.getItem(TEMPERATURE_KEY);
    if (saved) {
      const parsed = Number(saved);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  } catch {
    /* ignore corrupt local settings */
  }
  return DEFAULT_TEMPERATURE;
}

function persistSessionId(sessionId: string | null): void {
  if (sessionId) {
    localStorage.setItem(SESSION_KEY, sessionId);
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Unexpected error';
}

function isGmFailure(gm: GMResponse | null): boolean {
  return Boolean(gm?.internal_gm_notes?.startsWith('[GM_SERVICE_ERROR]'));
}

type RetryPayload =
  | { kind: 'action'; text: string }
  | { kind: 'roll'; total: number; natural?: number }
  | { kind: 'rest'; restKind: 'short' | 'long'; hitDiceSpent?: number };

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('menu');
  const [temperature, setTemperature] = useState<number>(readTemperature);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(() =>
    localStorage.getItem(SESSION_KEY)
  );
  const [session, setSession] = useState<GameSession | null>(null);
  const [lastGm, setLastGm] = useState<GMResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [setting, setSetting] = useState('');
  const [storyTemplate, setStoryTemplate] = useState<StoryTemplate>('dungeon_delve');
  const [saveSlots, setSaveSlots] = useState<SaveSlotInfo[]>([]);
  const [retryPayload, setRetryPayload] = useState<RetryPayload | null>(null);
  const allowAutoResume = useRef(true);

  const applySession = useCallback((next: GameSession) => {
    setSession(next);
    setSessionId(next.id);
    persistSessionId(next.id);
  }, []);

  const refreshSaves = useCallback(async (id: string) => {
    try {
      setSaveSlots(await listSaves(id));
    } catch {
      setSaveSlots([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    checkHealth()
      .then((ok) => {
        if (!cancelled) {
          setBackendOnline(ok);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBackendOnline(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionId || session || !allowAutoResume.current) {
      return;
    }
    let cancelled = false;
    getSession(sessionId)
      .then((loaded) => {
        if (cancelled || !allowAutoResume.current) {
          return;
        }
        applySession(loaded.session);
        setLastGm(loaded.last_gm_response);
        setCurrentScreen('game');
        void refreshSaves(loaded.session.id);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        persistSessionId(null);
        setSessionId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, session, applySession, refreshSaves]);

  useEffect(() => {
    if (!sessionId) {
      setSaveSlots([]);
      return;
    }
    void refreshSaves(sessionId);
  }, [sessionId, refreshSaves]);

  const handleSaveSettings = (nextTemperature: number) => {
    setTemperature(nextTemperature);
    localStorage.setItem(TEMPERATURE_KEY, String(nextTemperature));
    setCurrentScreen('menu');
  };

  const handleSetupComplete = (nextSetting: string, nextTemplate: StoryTemplate) => {
    setSetting(nextSetting);
    setStoryTemplate(nextTemplate);
    setCurrentScreen('creation');
  };

  const handleCharacterComplete = async (formCharacter: FormCharacter) => {
    setBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      const created = await createCharacter(toApiCharacter(formCharacter));
      const started = await startSession(created, setting, storyTemplate);
      applySession(started);
      setLastGm(null);
      setCurrentScreen('game');
      setRetryPayload({ kind: 'action', text: OPENING_ACTION });
      const opening = await postAction(started.id, OPENING_ACTION);
      applySession(opening.session);
      setLastGm(opening.gm_response);
      await refreshSaves(started.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handlePlayerAction = async (action: string) => {
    if (!session) {
      return;
    }
    setBusy(true);
    setError(null);
    setStatusMessage(null);
    setRetryPayload({ kind: 'action', text: action });
    try {
      const result = await postAction(session.id, action);
      applySession(result.session);
      setLastGm(result.gm_response);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRollComplete = async (total: number, natural?: number) => {
    if (!session) {
      return;
    }
    setBusy(true);
    setError(null);
    setStatusMessage(null);
    setRetryPayload({ kind: 'roll', total, natural });
    try {
      const result = await postRoll(session.id, total, natural);
      applySession(result.session);
      setLastGm(result.gm_response);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRest = async (kind: 'short' | 'long', hitDiceSpent = 0) => {
    if (!session) {
      return;
    }
    setBusy(true);
    setError(null);
    setStatusMessage(null);
    setRetryPayload({ kind: 'rest', restKind: kind, hitDiceSpent });
    try {
      const result = await postRest(session.id, kind, hitDiceSpent);
      applySession(result.session);
      setLastGm(result.gm_response);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRetry = () => {
    if (!retryPayload) {
      return;
    }
    if (retryPayload.kind === 'action') {
      void handlePlayerAction(retryPayload.text);
    } else if (retryPayload.kind === 'roll') {
      void handleRollComplete(retryPayload.total, retryPayload.natural);
    } else {
      void handleRest(retryPayload.restKind, retryPayload.hitDiceSpent);
    }
  };

  const handleSaveSlot = async (slot: number) => {
    if (!session) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveSlot(session.id, slot);
      await refreshSaves(session.id);
      setStatusMessage(`Saved to slot ${slot}.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleLoadSlot = async (slot: number) => {
    const id = sessionId;
    if (!id) {
      setError('No session to load. Start a new game, save a slot, then load it here.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const loaded = await loadSlot(id, slot);
      applySession(loaded);
      setLastGm(null);
      setStatusMessage(`Loaded slot ${slot}.`);
      setCurrentScreen('game');
      await refreshSaves(id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleNewGame = () => {
    allowAutoResume.current = false;
    setError(null);
    setStatusMessage(null);
    setLastGm(null);
    setSetting('');
    setStoryTemplate('dungeon_delve');
    setCurrentScreen('setup');
  };

  const handleQuitToMenu = () => {
    setError(null);
    setStatusMessage(null);
    setCurrentScreen('menu');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans selection:bg-yellow-900 selection:text-yellow-200">
      {currentScreen === 'menu' && (
        <MainMenuScreen
          onNewGame={handleNewGame}
          onLoadSlot={handleLoadSlot}
          onSettings={() => setCurrentScreen('settings')}
          canLoad={Boolean(sessionId)}
          backendOk={backendOnline}
          error={error}
          saveSlots={saveSlots}
        />
      )}
      {currentScreen === 'settings' && (
        <SettingsScreen
          currentTemperature={temperature}
          onSave={handleSaveSettings}
          onBack={() => setCurrentScreen('menu')}
        />
      )}
      {currentScreen === 'setup' && (
        <AdventureSetupScreen
          onSetupComplete={handleSetupComplete}
          onBack={() => setCurrentScreen('menu')}
        />
      )}
      {currentScreen === 'creation' && (
        <CharacterCreationScreen
          onStartGame={handleCharacterComplete}
          onBack={() => setCurrentScreen('setup')}
        />
      )}
      {currentScreen === 'game' && session && (
        <GameScreen
          session={session}
          lastGm={lastGm}
          isLoading={busy}
          error={error}
          statusMessage={statusMessage}
          saveSlots={saveSlots}
          canRetry={Boolean(retryPayload) && (Boolean(error) || isGmFailure(lastGm))}
          onSendMessage={handlePlayerAction}
          onRoll={handleRollComplete}
          onRest={handleRest}
          onSave={handleSaveSlot}
          onLoad={handleLoadSlot}
          onRetry={handleRetry}
          onGoToMenu={handleQuitToMenu}
        />
      )}
      {busy && currentScreen !== 'game' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="rounded border border-yellow-700 bg-gray-900 px-8 py-6 text-yellow-200 shadow-xl">
            Contacting the Game Master...
          </div>
        </div>
      )}
      {error && currentScreen !== 'menu' && currentScreen !== 'game' && (
        <div className="fixed bottom-4 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 px-4">
          <div className="rounded border border-red-800 bg-red-950/95 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
