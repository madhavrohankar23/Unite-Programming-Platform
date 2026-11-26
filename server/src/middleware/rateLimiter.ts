import rateLimit from 'express-rate-limit';

export function createApiRateLimiter(isTest: boolean) {
  return rateLimit({
    windowMs: 60 * 1000,
    max: isTest ? 5000 : 240,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please slow down and try again shortly.',
      },
    },
  });
}

export function createAuthRateLimiter(isTest: boolean) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isTest ? 5000 : 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'AUTH_RATE_LIMITED',
        message: 'Too many authentication attempts. Please wait a few minutes.',
      },
    },
  });
}

export function createExecutionRateLimiter(isTest: boolean) {
  return rateLimit({
    windowMs: 60 * 1000,
    max: isTest ? 5000 : 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'EXECUTION_RATE_LIMITED',
        message: 'Execution rate limit reached. Please wait a moment before running again.',
      },
    },
  });
}

