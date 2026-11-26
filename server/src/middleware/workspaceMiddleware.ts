import type { NextFunction, Request, Response } from 'express';
import type { WorkspaceRole } from '../../../shared/constants/roles.js';
import type { DatabaseRepositories } from '../database/types.js';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/errors.js';

export function createWorkspaceAccessMiddleware(
  db: DatabaseRepositories,
  allowedRoles?: readonly WorkspaceRole[],
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }
      const workspaceId = String(req.params.workspaceId ?? '');
      if (!workspaceId) {
        throw new NotFoundError('Workspace ID is required');
      }

      const workspace = await db.workspaces.findById(workspaceId);
      if (!workspace) {
        throw new NotFoundError('Workspace not found', 'WORKSPACE_NOT_FOUND');
      }

      const member = await db.workspaces.findMember(workspaceId, req.user.id);
      if (!member) {
        throw new ForbiddenError('You are not a member of this workspace', 'NOT_WORKSPACE_MEMBER');
      }

      if (allowedRoles && !allowedRoles.includes(member.role)) {
        throw new ForbiddenError(
          `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
          'INSUFFICIENT_ROLE',
        );
      }

      req.workspaceMember = member;
      next();
    } catch (err) {
      next(err);
    }
  };
}

