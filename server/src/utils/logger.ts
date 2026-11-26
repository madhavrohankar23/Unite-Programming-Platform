import pino from 'pino';

export function createLogger(level: string = process.env.NODE_ENV === 'test' ? 'silent' : 'info') {
  return pino({
    level,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'password',
        'token',
        'accessToken',
        'tokenHash',
        'SUPABASE_JWT_SECRET',
        'EXECUTION_API_KEY',
      ],
      censor: '[REDACTED]',
    },
  });
}

export type AppLogger = ReturnType<typeof createLogger>;

