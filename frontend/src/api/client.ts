/**
 * HTTP client for the backend FastAPI.
 * All requests use fetch(). Backend is proxied via Vite dev server.
 */
import type {
  ActionResponse,
  CreateSessionRequest,
  LoadSlotRequest,
  PlayerActionRequest,
  RestRequest,
  RollResultRequest,
  SaveSlotRequest,
  SessionResponse,
  Character,
} from "@/types/domain";

const BASE = "/api";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Session endpoints ──

export function createSession(data: CreateSessionRequest): Promise<SessionResponse> {
  return request<SessionResponse>(`${BASE}/session/start`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getSession(sessionId: string): Promise<SessionResponse> {
  return request<SessionResponse>(`${BASE}/session/${sessionId}`);
}

export function playerAction(
  sessionId: string,
  action: string,
): Promise<ActionResponse> {
  return request<ActionResponse>(`${BASE}/session/${sessionId}/action`, {
    method: "POST",
    body: JSON.stringify({ action, session_id: sessionId } satisfies PlayerActionRequest),
  });
}

export function submitRoll(
  sessionId: string,
  roll: number,
): Promise<ActionResponse> {
  return request<ActionResponse>(`${BASE}/session/${sessionId}/roll`, {
    method: "POST",
    body: JSON.stringify({ roll, session_id: sessionId } satisfies RollResultRequest),
  });
}

export function takeRest(
  sessionId: string,
  data: RestRequest,
): Promise<ActionResponse> {
  return request<ActionResponse>(`${BASE}/session/${sessionId}/rest`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function saveGame(
  sessionId: string,
  slot: number,
): Promise<{ saved: boolean; slot: number }> {
  return request(`${BASE}/session/${sessionId}/save`, {
    method: "POST",
    body: JSON.stringify({ slot } satisfies SaveSlotRequest),
  });
}

export function loadGame(
  sessionId: string,
  slot: number,
): Promise<SessionResponse> {
  return request<SessionResponse>(`${BASE}/session/${sessionId}/load`, {
    method: "POST",
    body: JSON.stringify({ slot } satisfies LoadSlotRequest),
  });
}

// ── Character endpoints ──

export function createCharacter(char: Character): Promise<Character> {
  return request<Character>(`${BASE}/character/create`, {
    method: "POST",
    body: JSON.stringify(char),
  });
}

export function listClasses(): Promise<string[]> {
  return request<string[]>(`${BASE}/character/classes`);
}

export function listRaces(): Promise<string[]> {
  return request<string[]>(`${BASE}/character/races`);
}

export function getAbilityModifier(score: number): Promise<{ score: number; modifier: number }> {
  return request(`${BASE}/character/ability-modifier/${score}`);
}
