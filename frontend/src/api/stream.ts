/**
 * WebSocket client for streaming GM narrative.
 * Protocol: see backend/app/api/routes/ws.py
 */
import type { WsServerMessage, StateChanges } from "@/types/domain";

export type StreamCallbacks = {
  onChunk?: (text: string) => void;
  onStateChanges?: (changes: StateChanges) => void;
  onSuggestedActions?: (actions: string[]) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
};

export class NarrativeStream {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private callbacks: StreamCallbacks;
  private _isActive = false;

  constructor(sessionId: string, callbacks: StreamCallbacks) {
    this.sessionId = sessionId;
    this.callbacks = callbacks;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  connect(): void {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws/session/${this.sessionId}/stream`;

    this.ws = new WebSocket(url);
    this._isActive = true;

    this.ws.onopen = () => {
      // Send periodic pings to keep the connection alive
      this._schedulePing();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      const msg: WsServerMessage = JSON.parse(event.data);
      switch (msg.type) {
        case "chunk":
          this.callbacks.onChunk?.(msg.text);
          break;
        case "state_changes":
          this.callbacks.onStateChanges?.(msg.data);
          break;
        case "suggested_actions":
          this.callbacks.onSuggestedActions?.(msg.data);
          break;
        case "done":
          this.callbacks.onDone?.();
          break;
        case "error":
          this.callbacks.onError?.(msg.message);
          break;
        case "pong":
          // heartbeat, ignore
          break;
      }
    };

    this.ws.onerror = () => {
      this.callbacks.onError?.("WebSocket connection error");
    };

    this.ws.onclose = () => {
      this._isActive = false;
    };
  }

  send(action: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action }));
    }
  }

  disconnect(): void {
    this._isActive = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private _schedulePing(): void {
    const ping = () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ action: "__ping__" }));
        setTimeout(ping, 25_000);
      }
    };
    setTimeout(ping, 25_000);
  }
}
