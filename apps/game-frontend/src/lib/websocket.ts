/**
 * WebSocket client for connecting to the BossRoom game server.
 * Handles connection, reconnection, and message routing to the Zustand store.
 */
import { serverMessageSchema, type ClientMessage, type ServerMessage } from '@bossroom/shared-types';
import { log } from './logger';

type MessageHandler = (msg: ServerMessage) => void;

class GameWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private handler: MessageHandler | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private username = '';
  private token = '';
  private tokenRefresher: (() => Promise<string>) | null = null;

  constructor() {
    this.url =
      typeof window !== 'undefined'
        ? (process.env['NEXT_PUBLIC_WS_URL'] ?? 'ws://localhost:8080')
        : 'ws://localhost:8080';
  }

  onMessage(handler: MessageHandler) {
    this.handler = handler;
  }

  setTokenRefresher(fn: () => Promise<string>) {
    this.tokenRefresher = fn;
  }

  connect(username: string, token: string) {
    log.info(`[ws] connecting as ${username}`);
    this.username = username;
    this.token = token;
    this.doConnect();
  }

  private async doConnect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    // If reconnecting and tokenRefresher exists, refresh the token first
    if (this.reconnectAttempts > 0 && this.tokenRefresher) {
      try {
        this.token = await this.tokenRefresher();
        log.debug('[ws] token refreshed for reconnect');
      } catch {
        log.warn('[ws] token refresh failed, giving up');
        this.handler?.({
          type: 'player:left',
          payload: { playerId: '__self__' },
        });
        return;
      }
    }

    this.createConnection();
  }

  private createConnection() {
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      log.error('[ws] failed to create WebSocket');
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      log.info('[ws] connected');
      this.reconnectAttempts = 0;
      this.send({
        type: 'player:join',
        payload: { username: this.username, token: this.token },
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const parsed = serverMessageSchema.safeParse(JSON.parse(event.data as string));
        if (!parsed.success) {
          log.warn('[ws] invalid server message:', parsed.error.issues);
          return;
        }
        log.debug(`[ws] recv ${parsed.data.type}`);
        this.handler?.(parsed.data);
      } catch {
        log.warn('[ws] unparseable server message');
      }
    };

    this.ws.onclose = () => {
      log.info('[ws] disconnected');
      this.handler?.({
        type: 'player:left',
        payload: { playerId: '__self__' },
      });
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      log.error('[ws] connection error');
      this.ws?.close();
    };
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      log.debug(`[ws] send ${msg.type}`);
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
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      log.warn(`[ws] max reconnect attempts (${this.maxReconnectAttempts}) reached`);
      return;
    }
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 10000);
    this.reconnectAttempts++;
    log.info(`[ws] reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
  }
}

export const gameSocket = new GameWebSocket();
