/**
 * WebSocket client for connecting to the BossRoom game server.
 * Handles connection, reconnection, and message routing to the Zustand store.
 * Gracefully handles server unavailability without console spam.
 */
import type { ClientMessage, ServerMessage } from '@bossroom/shared-types';

type MessageHandler = (msg: ServerMessage) => void;

class GameWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private handler: MessageHandler | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private username = '';
  private token = '';
  private tokenRefresher: (() => Promise<string>) | null = null;
  private intentionallyClosed = false;

  /** true when no real server URL is configured (e.g. deployed without backend) */
  private disabled = false;

  constructor() {
    const explicit = typeof window !== 'undefined'
      ? process.env['NEXT_PUBLIC_WS_URL']
      : undefined;

    // Only connect if explicit server URL is configured
    if (explicit && explicit.trim()) {
      this.url = explicit;
    } else if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      // HTTPS page but no WSS server configured — don't attempt insecure ws://
      this.url = '';
      this.disabled = true;
      console.log('[WS] No server configured for production — running in offline mode');
    } else if (typeof window !== 'undefined') {
      // Development mode on HTTP - use localhost
      this.url = 'ws://localhost:8080';
    } else {
      // SSR fallback
      this.url = '';
      this.disabled = true;
    }
  }

  onMessage(handler: MessageHandler) {
    this.handler = handler;
  }

  setTokenRefresher(fn: () => Promise<string>) {
    this.tokenRefresher = fn;
  }

  connect(username: string, token: string) {
    if (this.disabled) return;
    this.username = username;
    this.token = token;
    this.intentionallyClosed = false;
    this.reconnectAttempts = 0;
    this.doConnect();
  }

  private async doConnect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.intentionallyClosed) return;

    // If reconnecting and tokenRefresher exists, refresh the token first
    if (this.reconnectAttempts > 0 && this.tokenRefresher) {
      try {
        this.token = await this.tokenRefresher();
      } catch {
        // Can't refresh token — stop trying
        return;
      }
    }

    this.createConnection();
  }

  private createConnection() {
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      console.log('[WS] Connected to game server');
      this.send({
        type: 'player:join',
        payload: { username: this.username, token: this.token },
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data as string);
        this.handler?.(msg);
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      if (!this.intentionallyClosed) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // Suppress noisy console errors — onclose will handle reconnect
      this.ws?.close();
    };
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  disconnect() {
    this.intentionallyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close();
    this.ws = null;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private scheduleReconnect() {
    if (this.intentionallyClosed) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WS] Server unavailable — game works offline, connect server with `npm run dev`');
      return;
    }
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 8000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
  }
}

export const gameSocket = new GameWebSocket();
