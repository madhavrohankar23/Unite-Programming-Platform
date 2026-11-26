import type { ServerEnv } from '../utils/env.js';
import { createPrismaRepositories } from './prismaRepositories.js';
import type { DatabaseRepositories } from './types.js';

export async function createDatabase(env: ServerEnv): Promise<DatabaseRepositories> {
  if (env.STORAGE_DRIVER === 'prisma') {
    return createPrismaRepositories(env.DATABASE_URL);
  }
  const { createPgliteRepositories } = await import('./pgliteRepositories.js');
  return createPgliteRepositories(env.NODE_ENV === 'test' ? 'memory' : env.PGLITE_DATA_DIR);
}

export type { DatabaseRepositories } from './types.js';
