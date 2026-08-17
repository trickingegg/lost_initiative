import {
    ActionResponse,
    Character,
    GameSession,
    SaveSlotInfo,
    SessionResponse,
    StoryTemplate,
} from './types';

export class ApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

async function readError(response: Response): Promise<string> {
    try {
        const body = await response.json();
        if (typeof body.detail === 'string') {
            return body.detail;
        }
        if (Array.isArray(body.detail)) {
            return body.detail.map((item: { msg?: string }) => item.msg || JSON.stringify(item)).join('; ');
        }
        return JSON.stringify(body.detail ?? body);
    } catch {
        return response.statusText || 'Request failed';
    }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutMs = 90000;
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(path, {
            ...init,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                ...(init?.headers || {}),
            },
        });
        if (!response.ok) {
            throw new ApiError(response.status, await readError(response));
        }
        return response.json() as Promise<T>;
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            throw new ApiError(408, 'The Game Master took too long to respond. Retry the action.');
        }
        throw err;
    } finally {
        window.clearTimeout(timer);
    }
}

export async function checkHealth(): Promise<boolean> {
    try {
        const response = await fetch('/health');
        if (!response.ok) {
            return false;
        }
        const body = await response.json();
        return body.status === 'ok';
    } catch {
        return false;
    }
}

export async function createCharacter(character: Partial<Character>): Promise<Character> {
    return request<Character>('/api/character/create', {
        method: 'POST',
        body: JSON.stringify(character),
    });
}

export async function startSession(
    character: Character,
    setting: string,
    storyTemplate: StoryTemplate,
): Promise<GameSession> {
    const body = await request<SessionResponse>('/api/session/start', {
        method: 'POST',
        body: JSON.stringify({
            character,
            setting,
            story_template: storyTemplate,
        }),
    });
    return body.session;
}

export async function getSession(sessionId: string): Promise<SessionResponse> {
    return request<SessionResponse>(`/api/session/${sessionId}`);
}

export async function postAction(sessionId: string, action: string): Promise<ActionResponse> {
    return request<ActionResponse>(`/api/session/${sessionId}/action`, {
        method: 'POST',
        body: JSON.stringify({ action, session_id: sessionId }),
    });
}

export async function postRoll(
    sessionId: string,
    roll: number,
    natural?: number,
): Promise<ActionResponse> {
    return request<ActionResponse>(`/api/session/${sessionId}/roll`, {
        method: 'POST',
        body: JSON.stringify({ roll, session_id: sessionId, natural }),
    });
}

export async function getConditionDescriptions(): Promise<Record<string, string>> {
    return request<Record<string, string>>('/api/character/conditions');
}

export async function postRest(
    sessionId: string,
    type: 'short' | 'long',
    hitDiceSpent = 0,
): Promise<ActionResponse> {
    return request<ActionResponse>(`/api/session/${sessionId}/rest`, {
        method: 'POST',
        body: JSON.stringify({ type, hit_dice_spent: hitDiceSpent }),
    });
}

export async function saveSlot(sessionId: string, slot: number): Promise<SaveSlotInfo> {
    const body = await request<{ saved: boolean; slot: number; character_name: string; turn_count: number }>(
        `/api/session/${sessionId}/save`,
        {
            method: 'POST',
            body: JSON.stringify({ slot }),
        },
    );
    return {
        slot: body.slot,
        character_name: body.character_name,
        turn_count: body.turn_count,
        saved_at: new Date().toISOString(),
    };
}

export async function listSaves(sessionId: string): Promise<SaveSlotInfo[]> {
    const body = await request<{ slots: SaveSlotInfo[] }>(`/api/session/${sessionId}/saves`);
    return body.slots;
}

export async function loadSlot(sessionId: string, slot: number): Promise<GameSession> {
    const body = await request<SessionResponse>(`/api/session/${sessionId}/load`, {
        method: 'POST',
        body: JSON.stringify({ slot }),
    });
    return body.session;
}
