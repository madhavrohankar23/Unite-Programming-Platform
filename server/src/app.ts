import http from 'node:http';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createApiRouter } from './api/routes.js';
import { AuthService } from './auth/authService.js';
import { CollaborationServer } from './collaboration/collabServer.js';
import { WorkspaceEventHub } from './collaboration/workspaceEventHub.js';
import { createDatabase, type DatabaseRepositories } from './database/index.js';
import { HostedExecutionService } from './execution/executionService.js';
import { createErrorHandler } from './middleware/errorHandler.js';
import { createApiRateLimiter } from './middleware/rateLimiter.js';
import { TerminalGateway } from './terminal/terminalGateway.js';
import { loadEnv, type ServerEnv } from './utils/env.js';
import { createLogger, type AppLogger } from './utils/logger.js';
import { FileService } from './workspace/fileService.js';
import { WorkspaceService } from './workspace/workspaceService.js';

export interface UniteExpressAppInstance {
  env: ServerEnv;
  logger: AppLogger;
  db: DatabaseRepositories;
  authService: AuthService;
  workspaceService: WorkspaceService;
  fileService: FileService;
  app: express.Express;
}

export interface UniteServerInstance extends UniteExpressAppInstance {
  httpServer: http.Server;
  collabServer: CollaborationServer;
  eventHub: WorkspaceEventHub;
  terminalGateway: TerminalGateway;
  listen(port?: number): Promise<{ port: number }>;
  close(): Promise<void>;
}

function buildExpressApp(deps: {
  env: ServerEnv;
  logger: AppLogger;
  db: DatabaseRepositories;
  authService: AuthService;
  workspaceService: WorkspaceService;
  fileService: FileService;
  executionService: HostedExecutionService;
}): express.Express {
  const { env, logger } = deps;
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginEmbedderPolicy: false,
    }),
  );

  const allowedOrigins = env.CLIENT_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          cb(null, true);
          return;
        }
        cb(new Error(`CORS origin blocked: ${origin}`));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '512kb' }));
  app.use('/api', createApiRateLimiter(env.NODE_ENV === 'test'));
  app.use('/api', createApiRouter(deps));
  app.use(createApiRouter(deps));
  app.use(createErrorHandler(logger, env.NODE_ENV === 'production'));

  return app;
}

/**
 * Creates a stateless Express REST API instance (used by Vercel serverless functions).
 */
export async function createUniteExpressApp(
  envOverrides?: Partial<Record<string, string>>,
): Promise<UniteExpressAppInstance> {
  const env = loadEnv(envOverrides);
  const logger = createLogger(env.NODE_ENV === 'test' ? 'silent' : 'info');
  const db = await createDatabase(env);
  const authService = new AuthService(env, db);
  const workspaceService = new WorkspaceService(db);
  const fileService = new FileService(db);
  const executionService = new HostedExecutionService(env, db);

  const app = buildExpressApp({
    env,
    logger,
    db,
    authService,
    workspaceService,
    fileService,
    executionService,
  });

  return { env, logger, db, authService, workspaceService, fileService, app };
}

/**
 * Creates the full persistent Node.js server (Express + Hocuspocus + WebSocket hubs).
 */
export async function createUniteServer(
  envOverrides?: Partial<Record<string, string>>,
): Promise<UniteServerInstance> {
  const env = loadEnv(envOverrides);
  const logger = createLogger(env.NODE_ENV === 'test' ? 'silent' : 'info');
  const db = await createDatabase(env);
  const authService = new AuthService(env, db);
  const eventHub = new WorkspaceEventHub(authService, db, logger);
  const collabServer = new CollaborationServer(authService, db, logger);
  const workspaceService = new WorkspaceService(db, eventHub);
  const fileService = new FileService(db, eventHub, collabServer);
  const executionService = new HostedExecutionService(env, db);
  const terminalGateway = new TerminalGateway(env, authService, db, logger);

  const app = buildExpressApp({
    env,
    logger,
    db,
    authService,
    workspaceService,
    fileService,
    executionService,
  });

  const httpServer = http.createServer(app);

  httpServer.on('upgrade', (req, socket, head) => {
    const pathname = new URL(req.url ?? '', 'http://localhost').pathname;
    if (pathname.startsWith('/collab')) {
      collabServer.handleUpgrade(req, socket, head);
    } else if (pathname.startsWith('/ws/events')) {
      eventHub.handleUpgrade(req, socket, head);
    } else if (pathname.startsWith('/ws/notifications')) {
      eventHub.handleUserNotificationUpgrade(req, socket, head);
    } else if (pathname.startsWith('/ws/terminal')) {
      terminalGateway.handleUpgrade(req, socket, head);
    } else {
      socket.destroy();
    }
  });

  return {
    env,
    logger,
    db,
    authService,
    workspaceService,
    fileService,
    app,
    httpServer,
    collabServer,
    eventHub,
    terminalGateway,
    listen(port = env.PORT) {
      return new Promise((resolve) => {
        httpServer.listen(port, env.HOST, () => {
          const addr = httpServer.address();
          const actualPort = typeof addr === 'object' && addr ? addr.port : port;
          logger.info(
            {
              port: actualPort,
              authProvider: env.AUTH_PROVIDER,
              storageDriver: env.STORAGE_DRIVER,
            },
            'Unite server listening',
          );
          resolve({ port: actualPort });
        });
      });
    },
    async close() {
      await collabServer.close();
      await eventHub.close();
      await terminalGateway.close();
      await new Promise<void>((resolve) => {
        if (!httpServer.listening) {
          resolve();
          return;
        }
        httpServer.close(() => resolve());
      });
      await db.close();
    },
  };
}
