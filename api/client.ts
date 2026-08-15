import {
    ActionResponse,
    Character,
    GameSession,
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
    const response = await fetch(path, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...(init?.headers || {}),
        },
    });
    if (!response.ok) {
        throw new ApiError(response.status, await readError(response));
    }
    return response.json() as Promise<T>;
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

export async function postRoll(sessionId: string, roll: number): Promise<ActionResponse> {
    return request<ActionResponse>(`/api/session/${sessionId}/roll`, {
        method: 'POST',
        body: JSON.stringify({ roll, session_id: sessionId }),
    });
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

export async function saveSlot(sessionId: string, slot: number): Promise<void> {
    await request(`/api/session/${sessionId}/save`, {
        method: 'POST',
        body: JSON.stringify({ slot }),
    });
}

export async function loadSlot(sessionId: string, slot: number): Promise<GameSession> {
    const body = await request<SessionResponse>(`/api/session/${sessionId}/load`, {
        method: 'POST',
        body: JSON.stringify({ slot }),
    });
    return body.session;
}
