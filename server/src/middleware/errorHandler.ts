import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors.js';
import type { AppLogger } from '../utils/logger.js';

export function createErrorHandler(logger: AppLogger, isProduction: boolean) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      });
      return;
    }

    if (
      typeof err === 'object' &&
      err !== null &&
      'type' in err &&
      (err as { type?: string }).type === 'entity.too.large'
    ) {
      res.status(413).json({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request payload exceeds maximum allowed size',
        },
      });
      return;
    }

    logger.error({ err, method: req.method, path: req.path }, 'Unhandled server error');
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: isProduction
          ? 'An unexpected error occurred'
          : err instanceof Error
            ? err.message
            : 'Internal server error',
      },
    });
  };
}

