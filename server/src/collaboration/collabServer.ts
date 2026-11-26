import type { IncomingMessage } from 'node:http';
import { Hocuspocus } from '@hocuspocus/server';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { parseCollabDocName } from '../../../shared/types/models.js';
import type { AuthService } from '../auth/authService.js';
import type { DatabaseRepositories } from '../database/types.js';
import { generateSecureId } from '../security/tokens.js';
import type { AppLogger } from '../utils/logger.js';

export interface CollabContext {
  userId: string;
  displayName: string;
  workspaceId: string;
  fileId: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
}

export class CollaborationServer {
  public readonly hocuspocus: Hocuspocus;
  private readonly wss: WebSocketServer;

  constructor(
    private readonly authService: AuthService,
    private readonly db: DatabaseRepositories,
    private readonly logger: AppLogger,
  ) {
    this.wss = new WebSocketServer({ noServer: true });
    this.hocuspocus = new Hocuspocus({
      name: 'unite-collab',
      quiet: true,
      debounce: 500,
      maxDebounce: 2500,
      stopOnSignals: false,
      onAuthenticate: async ({ token, documentName, connection }) => {
        if (!token) {
          throw new Error('Authentication token required for collaboration');
        }
        const user = await this.authService.verifyAccessToken(token);
        const parsed = parseCollabDocName(documentName);
        if (!parsed) {
          throw new Error('Invalid collaboration document identifier');
        }
        const member = await this.db.workspaces.findMember(parsed.workspaceId, user.id);
        if (!member) {
          throw new Error('Forbidden: not a member of this workspace');
        }
        const file = await this.db.files.findById(parsed.workspaceId, parsed.fileId);
        if (!file || file.nodeType !== 'FILE') {
          throw new Error('Document file not found in workspace');
        }

        // Enforce read-only at the Hocuspocus protocol level for VIEWERs
        connection.readOnly = member.role === 'VIEWER';

        const context: CollabContext = {
          userId: user.id,
          displayName: user.displayName,
          workspaceId: parsed.workspaceId,
          fileId: parsed.fileId,
          role: member.role,
        };
        return context;
      },

      onLoadDocument: async ({ documentName, document }) => {
        const parsed = parseCollabDocName(documentName);
        if (!parsed) return document;

        const existing = await this.db.collab.findByDocName(documentName);
        if (existing && existing.state.byteLength > 0) {
          Y.applyUpdate(document, existing.state);
          return document;
        }

        // Seed initial Y.Text('monaco') from persisted file snapshot on first open
        const file = await this.db.files.findById(parsed.workspaceId, parsed.fileId);
        const initialText = file?.contentSnapshot ?? '';
        const yText = document.getText('monaco');
        if (yText.length === 0 && initialText.length > 0) {
          yText.insert(0, initialText);
        }
        return document;
      },

      onStoreDocument: async ({ documentName, document }) => {
        const parsed = parseCollabDocName(documentName);
        if (!parsed) return;

        const state = Y.encodeStateAsUpdate(document);
        const text = document.getText('monaco').toString();

        await this.db.collab.upsertDocument({
          id: generateSecureId('doc'),
          docName: documentName,
          workspaceId: parsed.workspaceId,
          fileId: parsed.fileId,
          state,
        });
        await this.db.files.updateSnapshot(parsed.fileId, text);
      },
    });

    this.wss.on('connection', (ws, req) => {
      this.hocuspocus.handleConnection(ws, req);
    });
  }

  public handleUpgrade(req: IncomingMessage, socket: import('node:stream').Duplex, head: Buffer) {
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.wss.emit('connection', ws, req);
    });
  }

  public async replaceDocumentContent(
    workspaceId: string,
    fileId: string,
    content: string,
  ): Promise<void> {
    const docName = `workspace:${workspaceId}:file:${fileId}`;
    const activeDoc = this.hocuspocus.documents.get(docName);
    if (activeDoc) {
      activeDoc.transact(() => {
        const yText = activeDoc.getText('monaco');
        if (yText.toString() !== content) {
          yText.delete(0, yText.length);
          if (content.length > 0) {
            yText.insert(0, content);
          }
        }
      });
      const state = Y.encodeStateAsUpdate(activeDoc);
      await this.db.collab.upsertDocument({
        id: generateSecureId('doc'),
        docName,
        workspaceId,
        fileId,
        state,
      });
      return;
    }

    const tempDoc = new Y.Doc();
    if (content.length > 0) {
      tempDoc.getText('monaco').insert(0, content);
    }
    const state = Y.encodeStateAsUpdate(tempDoc);
    tempDoc.destroy();
    await this.db.collab.upsertDocument({
      id: generateSecureId('doc'),
      docName,
      workspaceId,
      fileId,
      state,
    });
  }

  public async close(): Promise<void> {
    try {
      await this.hocuspocus.destroy();
    } catch (err) {
      this.logger.warn({ err }, 'Error destroying Hocuspocus server');
    }
    await new Promise<void>((resolve) => {
      this.wss.close(() => resolve());
    });
  }
}

