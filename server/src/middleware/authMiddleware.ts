import type { NextFunction, Request, Response } from 'express';
import type { UserProfileDto, WorkspaceMemberDto } from '../../../shared/types/models.js';
import type { AuthService } from '../auth/authService.js';
import { UnauthorizedError } from '../utils/errors.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: UserProfileDto;
    workspaceMember?: WorkspaceMemberDto;
  }
}

export function extractBearerToken(headerValue: string | undefined): string | null {
  if (!headerValue) return null;
  const parts = headerValue.split(' ');
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer' || !parts[1]) {
    return null;
  }
  return parts[1].trim();
}

export function createAuthMiddleware(authService: AuthService) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = extractBearerToken(req.headers.authorization);
      if (!token) {
        throw new UnauthorizedError('Missing Bearer authentication token');
      }
      req.user = await authService.verifyAccessToken(token);
      next();
    } catch (err) {
      next(err);
    }
  };
}
