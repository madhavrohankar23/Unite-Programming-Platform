import type { IncomingMessage } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { WorkspaceEventPayload } from '../../../shared/types/models.js';
import type { AuthService } from '../auth/authService.js';
import type { DatabaseRepositories } from '../database/types.js';
import { generateSecureId } from '../security/tokens.js';
import type { AppLogger } from '../utils/logger.js';

interface ConnectedClient {
  ws: WebSocket;
  workspaceId: string;
  userId: string;
  displayName: string;
}

export class WorkspaceEventHub {
  private readonly wss: WebSocketServer;
  private readonly userWss: WebSocketServer;
  private readonly rooms = new Map<string, Set<ConnectedClient>>();
  private readonly userSockets = new Map<string, Set<WebSocket>>();

  constructor(
    private readonly authService: AuthService,
    private readonly db: DatabaseRepositories,
    private readonly logger: AppLogger,
  ) {
    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on('connection', (ws, req) => {
      void this.handleConnection(ws, req);
    });

    this.userWss = new WebSocketServer({ noServer: true });
    this.userWss.on('connection', (ws, req) => {
      void this.handleUserNotificationConnection(ws, req);
    });
  }

  public handleUpgrade(req: IncomingMessage, socket: import('node:stream').Duplex, head: Buffer) {
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.wss.emit('connection', ws, req);
    });
  }

  public handleUserNotificationUpgrade(
    req: IncomingMessage,
    socket: import('node:stream').Duplex,
    head: Buffer,
  ) {
    this.userWss.handleUpgrade(req, socket, head, (ws) => {
      this.userWss.emit('connection', ws, req);
    });
  }

  private async handleUserNotificationConnection(ws: WebSocket, req: IncomingMessage) {
    try {
      const url = new URL(req.url ?? '', 'http://localhost');
      const token = url.searchParams.get('token') ?? '';
      if (!token) {
        ws.close(4001, 'Missing token');
        return;
      }
      const user = await this.authService.verifyAccessToken(token);
      let sockets = this.userSockets.get(user.id);
      if (!sockets) {
        sockets = new Set();
        this.userSockets.set(user.id, sockets);
      }
      sockets.add(ws);

      ws.on('close', () => {
        const set = this.userSockets.get(user.id);
        if (!set) return;
        set.delete(ws);
        if (set.size === 0) this.userSockets.delete(user.id);
      });

      ws.send(JSON.stringify({ type: 'notifications:ready', userId: user.id }));
    } catch (err) {
      this.logger.warn({ err }, 'Rejected user notification WebSocket connection');
      ws.close(4001, 'Authentication failed');
    }
  }

  private async handleConnection(ws: WebSocket, req: IncomingMessage) {
    try {
      const url = new URL(req.url ?? '', 'http://localhost');
      const token = url.searchParams.get('token') ?? '';
      const workspaceId = url.searchParams.get('workspaceId') ?? '';

      if (!token || !workspaceId) {
        ws.close(4001, 'Missing token or workspaceId');
        return;
      }

      const user = await this.authService.verifyAccessToken(token);
      const member = await this.db.workspaces.findMember(workspaceId, user.id);
      if (!member) {
        ws.close(4003, 'Not authorized for this workspace');
        return;
      }

      const client: ConnectedClient = {
        ws,
        workspaceId,
        userId: user.id,
        displayName: user.displayName,
      };

      let room = this.rooms.get(workspaceId);
      if (!room) {
        room = new Set();
        this.rooms.set(workspaceId, room);
      }
      room.add(client);

      ws.on('message', (raw) => {
        try {
          const parsed = JSON.parse(raw.toString()) as { type?: string; text?: string };
          if (parsed.type === 'chat:send' && typeof parsed.text === 'string') {
            const text = parsed.text.trim().slice(0, 1000);
            if (!text) return;
            this.broadcast(workspaceId, {
              type: 'chat:message',
              workspaceId,
              id: generateSecureId('msg'),
              userId: user.id,
              displayName: user.displayName,
              text,
              sentAt: new Date().toISOString(),
            });
          }
        } catch {
          // Ignore malformed client frames
        }
      });

      ws.on('close', () => {
        const currentRoom = this.rooms.get(workspaceId);
        if (!currentRoom) return;
        currentRoom.delete(client);
        if (currentRoom.size === 0) {
          this.rooms.delete(workspaceId);
        }
      });

      ws.send(JSON.stringify({ type: 'connected', workspaceId }));
    } catch (err) {
      this.logger.warn({ err }, 'Rejected workspace events WebSocket connection');
      ws.close(4001, 'Authentication failed');
    }
  }

  public broadcast(workspaceId: string, event: WorkspaceEventPayload): void {
    const room = this.rooms.get(workspaceId);
    if (!room || room.size === 0) return;
    const payload = JSON.stringify(event);
    for (const client of room) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  public sendToUser(userId: string, event: WorkspaceEventPayload): void {
    const sockets = this.userSockets.get(userId);
    if (!sockets || sockets.size === 0) return;
    const payload = JSON.stringify(event);
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  public close(): Promise<void> {
    return new Promise((resolve) => {
      for (const room of this.rooms.values()) {
        for (const client of room) {
          client.ws.close(1001, 'Server shutting down');
        }
      }
      this.rooms.clear();
      for (const set of this.userSockets.values()) {
        for (const ws of set) {
          ws.close(1001, 'Server shutting down');
        }
      }
      this.userSockets.clear();
      this.wss.close(() => {
        this.userWss.close(() => resolve());
      });
    });
  }
}
