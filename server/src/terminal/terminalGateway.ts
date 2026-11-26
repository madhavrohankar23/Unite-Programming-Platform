import type { IncomingMessage } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { canUseTerminal } from '../../../shared/constants/roles.js';
import type { AuthService } from '../auth/authService.js';
import type { DatabaseRepositories } from '../database/types.js';
import type { ServerEnv } from '../utils/env.js';
import type { AppLogger } from '../utils/logger.js';

/**
 * Authenticated WebSocket terminal gateway.
 * Verifies user JWT and OWNER/EDITOR role before establishing any session.
 * Never opens a host OS shell; delegates only if TERMINAL_GATEWAY_URL is configured.
 */
export class TerminalGateway {
  private readonly wss: WebSocketServer;

  constructor(
    private readonly env: ServerEnv,
    private readonly authService: AuthService,
    private readonly db: DatabaseRepositories,
    private readonly logger: AppLogger,
  ) {
    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on('connection', (ws, req) => {
      void this.handleConnection(ws, req);
    });
  }

  public handleUpgrade(req: IncomingMessage, socket: import('node:stream').Duplex, head: Buffer) {
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.wss.emit('connection', ws, req);
    });
  }

  private async handleConnection(ws: WebSocket, req: IncomingMessage) {
    try {
      const url = new URL(req.url ?? '', 'http://localhost');
      const token = url.searchParams.get('token') ?? '';
      const workspaceId = url.searchParams.get('workspaceId') ?? '';

      if (!token || !workspaceId) {
        ws.close(4001, 'Missing authentication token or workspaceId');
        return;
      }

      const user = await this.authService.verifyAccessToken(token);
      const member = await this.db.workspaces.findMember(workspaceId, user.id);
      if (!member) {
        ws.close(4003, 'Forbidden: not a workspace member');
        return;
      }
      if (!canUseTerminal(member.role)) {
        ws.close(4003, 'Forbidden: viewers cannot open terminal sessions');
        return;
      }

      if (!this.env.TERMINAL_GATEWAY_URL) {
        ws.send(
          JSON.stringify({
            type: 'status',
            mode: 'browser-sandbox',
            message:
              'Authenticated with Unite terminal gateway. No remote TERMINAL_GATEWAY_URL configured; interactive shell runs inside your browser WebContainer sandbox.',
          }),
        );
        return;
      }

      // Bridge to configured isolated remote terminal gateway
      const upstream = new WebSocket(
        `${this.env.TERMINAL_GATEWAY_URL}?workspaceId=${encodeURIComponent(workspaceId)}&userId=${encodeURIComponent(user.id)}`,
      );

      upstream.on('open', () => {
        ws.send(JSON.stringify({ type: 'status', mode: 'remote-sandbox', message: 'Connected to remote terminal sandbox' }));
      });
      upstream.on('message', (data) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data);
      });
      upstream.on('close', () => ws.close(1000, 'Remote terminal closed'));
      upstream.on('error', () => ws.close(1011, 'Remote terminal unavailable'));

      ws.on('message', (data) => {
        if (upstream.readyState === WebSocket.OPEN) upstream.send(data);
      });
      ws.on('close', () => {
        if (upstream.readyState === WebSocket.OPEN) upstream.close();
      });
    } catch (err) {
      this.logger.warn({ err }, 'Rejected terminal WebSocket connection');
      ws.close(4001, 'Authentication failed');
    }
  }

  public close(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close(() => resolve());
    });
  }
}

