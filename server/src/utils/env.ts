import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('0.0.0.0'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().optional().default(''),
  STORAGE_DRIVER: z.enum(['prisma', 'pglite']).default('pglite'),
  PGLITE_DATA_DIR: z.string().default('.unite-data/pgdata'),

  AUTH_PROVIDER: z.enum(['supabase', 'local']).default('local'),
  SUPABASE_URL: z.string().optional().default(''),
  SUPABASE_ANON_KEY: z.string().optional().default(''),
  SUPABASE_JWT_SECRET: z.string().optional().default(''),
  LOCAL_JWT_SECRET: z
    .string()
    .min(16)
    .default('unite-local-dev-jwt-secret-change-in-production'),

  EXECUTION_PROVIDER: z.enum(['piston', 'disabled']).default('piston'),
  EXECUTION_API_URL: z.string().default('https://emkc.org/api/v2/piston/execute'),
  EXECUTION_API_KEY: z.string().optional().default(''),
  EXECUTION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(10000),
  EXECUTION_MAX_OUTPUT_BYTES: z.coerce.number().int().min(1024).max(262144).default(65536),

  TERMINAL_GATEWAY_URL: z.string().optional().default(''),
});

export type ServerEnv = z.infer<typeof envSchema>;

export function loadEnv(overrides?: Partial<Record<string, string>>): ServerEnv {
  const merged = { ...process.env, ...overrides };
  const parsed = envSchema.safeParse(merged);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid server environment configuration: ${formatted}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production' && env.AUTH_PROVIDER === 'supabase') {
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required when AUTH_PROVIDER=supabase');
    }
  }
  if (env.NODE_ENV === 'production' && env.STORAGE_DRIVER === 'prisma' && !env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required when STORAGE_DRIVER=prisma');
  }
  return env;
}

