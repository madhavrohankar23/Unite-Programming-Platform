import type { IncomingMessage, ServerResponse } from 'node:http';
import { createUniteExpressApp, type UniteExpressAppInstance } from '../server/src/app.js';

let cachedAppPromise: Promise<UniteExpressAppInstance> | null = null;

function getAppInstance(): Promise<UniteExpressAppInstance> {
  if (!cachedAppPromise) {
    if (!process.env.DATABASE_URL && process.env.POSTGRES_PRISMA_URL) {
      process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
    } else if (!process.env.DATABASE_URL && process.env.POSTGRES_URL) {
      process.env.DATABASE_URL = process.env.POSTGRES_URL;
    }

    const storageDriver = process.env.DATABASE_URL ? 'prisma' : 'pglite';
    const authProvider =
      process.env.AUTH_PROVIDER === 'supabase' && process.env.SUPABASE_URL
        ? 'supabase'
        : 'local';

    cachedAppPromise = createUniteExpressApp({
      NODE_ENV: 'production',
      STORAGE_DRIVER: storageDriver,
      AUTH_PROVIDER: authProvider,
      CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || '*',
    }).catch((err) => {
      cachedAppPromise = null;
      throw err;
    });
  }
  return cachedAppPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    // When Vercel rewrites /api/(.*) to /api, resolve the original request URL
    const originalUrl =
      (req.headers['x-matched-path'] as string) ||
      (req.headers['x-rewrite-url'] as string) ||
      req.url ||
      '/';

    if (originalUrl && originalUrl !== '/api') {
      req.url = originalUrl;
    }

    const instance = await getAppInstance();
    return instance.app(req as Parameters<typeof instance.app>[0], res as Parameters<typeof instance.app>[1]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('API Serverless Error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: message || 'Internal Server Error' }));
  }
}
