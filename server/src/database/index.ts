import type { ServerEnv } from '../utils/env.js';
import { createPgliteRepositories } from './pgliteRepositories.js';
import { createPrismaRepositories } from './prismaRepositories.js';
import type { DatabaseRepositories } from './types.js';

export async function createDatabase(env: ServerEnv): Promise<DatabaseRepositories> {
  if (env.STORAGE_DRIVER === 'prisma') {
    return createPrismaRepositories(env.DATABASE_URL);
  }
  return createPgliteRepositories(env.NODE_ENV === 'test' ? 'memory' : env.PGLITE_DATA_DIR);
}

export type { DatabaseRepositories } from './types.js';

