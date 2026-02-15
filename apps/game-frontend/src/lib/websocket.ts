/**
 * WebSocket client for connecting to the BossRoom game server.
 * Handles connection, reconnection, and message routing to the Zustand store.
 */
import type { ClientMessage, ServerMessage } from '@bossroom/shared-types';

type MessageHandler = (msg: ServerMessage) => void;

class GameWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private handler: MessageHandler | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private username = 'Player';

  constructor() {
    this.url =
      typeof window !== 'undefined'
        ? (process.env['NEXT_PUBLIC_WS_URL'] ?? 'ws://localhost:8080')
        : 'ws://localhost:8080';
  }

  onMessage(handler: MessageHandler) {
    this.handler = handler;
  }

  connect(username: string) {
    this.username = username;
    this.doConnect();
  }

  private doConnect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.send({
        type: 'player:join',
        payload: { username: this.username, token: '' },
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
      this.handler?.({
        type: 'player:left',
        payload: { playerId: '__self__' },
      } as ServerMessage);
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 10000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
  }
}

export const gameSocket = new GameWebSocket();
