import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { BadRequestError } from '../utils/errors.js';

export function validateBody<T extends ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      next(
        new BadRequestError(
          details[0]?.message ?? 'Invalid request payload',
          'VALIDATION_ERROR',
          details,
        ),
      );
      return;
    }
    req.body = parsed.data;
    next();
  };
}

