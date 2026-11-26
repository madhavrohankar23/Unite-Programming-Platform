import { Router } from 'express';
import {
  createChangeRequestSchema,
  createFileNodeSchema,
  createInvitationSchema,
  createWorkspaceSchema,
  decideChangeRequestSchema,
  decideJoinRequestSchema,
  executeCodeSchema,
  joinWorkspaceSchema,
  loginSchema,
  recordClientExecutionSchema,
  registerSchema,
  submitJoinRequestSchema,
  updateFileNodeSchema,
  updateMemberRoleSchema,
  updateProfileSchema,
  updateWorkspaceSchema,
} from '../../../shared/schemas/validation.js';
import type { AuthService } from '../auth/authService.js';
import type { DatabaseRepositories } from '../database/types.js';
import type { HostedExecutionService } from '../execution/executionService.js';
import { createAuthMiddleware } from '../middleware/authMiddleware.js';
import {
  createAuthRateLimiter,
  createExecutionRateLimiter,
} from '../middleware/rateLimiter.js';
import { validateBody } from '../middleware/validate.js';
import { createWorkspaceAccessMiddleware } from '../middleware/workspaceMiddleware.js';
import { generateSecureId } from '../security/tokens.js';
import type { ServerEnv } from '../utils/env.js';
import type { FileService } from '../workspace/fileService.js';
import type { WorkspaceService } from '../workspace/workspaceService.js';

export function createApiRouter(deps: {
  env: ServerEnv;
  db: DatabaseRepositories;
  authService: AuthService;
  workspaceService: WorkspaceService;
  fileService: FileService;
  executionService: HostedExecutionService;
}) {
  const router = Router();
  const isTest = deps.env.NODE_ENV === 'test';
  const requireAuth = createAuthMiddleware(deps.authService);
  const authLimiter = createAuthRateLimiter(isTest);
  const execLimiter = createExecutionRateLimiter(isTest);

  const requireMember = createWorkspaceAccessMiddleware(deps.db);
  const requireEditor = createWorkspaceAccessMiddleware(deps.db, ['OWNER', 'EDITOR']);
  const requireOwner = createWorkspaceAccessMiddleware(deps.db, ['OWNER']);

  // Health & config check
  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'unite-api',
      authProvider: deps.authService.getMode(),
      storageDriver: deps.env.STORAGE_DRIVER,
      hostedExecutionEnabled: deps.env.EXECUTION_PROVIDER !== 'disabled',
      timestamp: new Date().toISOString(),
    });
  });

  // Auth routes
  router.post('/auth/register', authLimiter, validateBody(registerSchema), async (req, res, next) => {
    try {
      const session = await deps.authService.registerLocal(req.body);
      res.status(201).json(session);
    } catch (err) {
      next(err);
    }
  });

  router.post('/auth/login', authLimiter, validateBody(loginSchema), async (req, res, next) => {
    try {
      const session = await deps.authService.loginLocal(req.body);
      res.json(session);
    } catch (err) {
      next(err);
    }
  });

  router.get('/auth/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  router.patch('/auth/me', requireAuth, validateBody(updateProfileSchema), async (req, res, next) => {
    try {
      const updated = await deps.db.users.updateProfile(req.user!.id, req.body);
      const { passwordHash: _ph, ...user } = updated;
      res.json({ user });
    } catch (err) {
      next(err);
    }
  });

  // Workspaces
  router.get('/workspaces', requireAuth, async (req, res, next) => {
    try {
      const workspaces = await deps.workspaceService.listForUser(req.user!.id);
      res.json({ workspaces });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/workspaces',
    requireAuth,
    validateBody(createWorkspaceSchema),
    async (req, res, next) => {
      try {
        const result = await deps.workspaceService.createWorkspace(req.user!, req.body);
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // 6-Digit Join Request Approval Flow
  router.post(
    '/workspaces/join-requests',
    requireAuth,
    validateBody(submitJoinRequestSchema),
    async (req, res, next) => {
      try {
        const result = await deps.workspaceService.submitJoinRequest(
          req.user!,
          req.body.joinCode,
        );
        res.status(result.alreadyMember ? 200 : 202).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get('/join-requests/:requestId', requireAuth, async (req, res, next) => {
    try {
      const request = await deps.workspaceService.getJoinRequestStatus(
        String(req.params.requestId),
        req.user!,
      );
      res.json({ request });
    } catch (err) {
      next(err);
    }
  });

  router.get(
    '/workspaces/:workspaceId/join-requests',
    requireAuth,
    requireOwner,
    async (req, res, next) => {
      try {
        const requests = await deps.workspaceService.listPendingJoinRequests(
          String(req.params.workspaceId),
        );
        res.json({ requests });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/workspaces/:workspaceId/join-requests/:requestId/decide',
    requireAuth,
    requireOwner,
    validateBody(decideJoinRequestSchema),
    async (req, res, next) => {
      try {
        const request = await deps.workspaceService.decideJoinRequest(
          String(req.params.workspaceId),
          String(req.params.requestId),
          req.user!,
          req.body,
        );
        res.json({ request });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get('/workspaces/:workspaceId', requireAuth, requireMember, async (req, res, next) => {
    try {
      const workspace = await deps.workspaceService.getWorkspaceDetails(
        String(req.params.workspaceId),
        req.workspaceMember!,
      );
      res.json({ workspace });
    } catch (err) {
      next(err);
    }
  });

  router.patch(
    '/workspaces/:workspaceId',
    requireAuth,
    requireOwner,
    validateBody(updateWorkspaceSchema),
    async (req, res, next) => {
      try {
        const workspace = await deps.workspaceService.updateWorkspace(
          String(req.params.workspaceId),
          req.user!,
          req.body,
        );
        res.json({ workspace });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete('/workspaces/:workspaceId', requireAuth, requireOwner, async (req, res, next) => {
    try {
      await deps.workspaceService.deleteWorkspace(String(req.params.workspaceId), req.user!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // Membership & Invitations
  router.get(
    '/workspaces/:workspaceId/members',
    requireAuth,
    requireMember,
    async (req, res, next) => {
      try {
        const members = await deps.db.workspaces.listMembers(String(req.params.workspaceId));
        res.json({ members });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/workspaces/:workspaceId/members/:userId',
    requireAuth,
    requireOwner,
    validateBody(updateMemberRoleSchema),
    async (req, res, next) => {
      try {
        const member = await deps.workspaceService.updateMemberRole(
          String(req.params.workspaceId),
          String(req.params.userId),
          req.body.role,
          req.user!,
        );
        res.json({ member });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/workspaces/:workspaceId/members/:userId',
    requireAuth,
    requireOwner,
    async (req, res, next) => {
      try {
        await deps.workspaceService.removeMember(
          String(req.params.workspaceId),
          String(req.params.userId),
          req.user!,
        );
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  router.post('/workspaces/:workspaceId/leave', requireAuth, requireMember, async (req, res, next) => {
    try {
      await deps.workspaceService.leaveWorkspace(String(req.params.workspaceId), req.user!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/workspaces/:workspaceId/invitations',
    requireAuth,
    requireEditor,
    validateBody(createInvitationSchema),
    async (req, res, next) => {
      try {
        const invitation = await deps.workspaceService.createInvitation(
          String(req.params.workspaceId),
          req.user!,
          req.body,
        );
        res.status(201).json({ invitation });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/workspaces/:workspaceId/invitations',
    requireAuth,
    requireEditor,
    async (req, res, next) => {
      try {
        const invitations = await deps.workspaceService.listInvitations(
          String(req.params.workspaceId),
        );
        res.json({ invitations });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/workspaces/:workspaceId/invitations/:invitationId',
    requireAuth,
    requireEditor,
    async (req, res, next) => {
      try {
        await deps.workspaceService.revokeInvitation(
          String(req.params.workspaceId),
          String(req.params.invitationId),
          req.user!,
        );
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/invitations/validate',
    requireAuth,
    validateBody(joinWorkspaceSchema),
    async (req, res, next) => {
      try {
        const validated = await deps.workspaceService.validateInvitation(req.body.tokenOrCode);
        if (validated.mode === 'approval-required') {
          res.json({
            valid: true,
            mode: 'approval-required',
            workspaceId: validated.workspace.id,
            workspaceName: validated.workspace.name,
            role: null,
            expiresAt: null,
          });
          return;
        }
        res.json({
          valid: true,
          mode: 'direct-invite',
          workspaceId: validated.workspace.id,
          workspaceName: validated.workspace.name,
          role: validated.invitation.role,
          expiresAt: validated.invitation.expiresAt,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/invitations/join',
    requireAuth,
    validateBody(joinWorkspaceSchema),
    async (req, res, next) => {
      try {
        const workspace = await deps.workspaceService.joinWorkspace(
          req.user!,
          req.body.tokenOrCode,
        );
        res.json({ workspace });
      } catch (err) {
        next(err);
      }
    },
  );

  // Files & Folders
  router.get('/workspaces/:workspaceId/files', requireAuth, requireMember, async (req, res, next) => {
    try {
      const files = await deps.fileService.listFiles(String(req.params.workspaceId));
      res.json({ files });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/workspaces/:workspaceId/files',
    requireAuth,
    requireEditor,
    validateBody(createFileNodeSchema),
    async (req, res, next) => {
      try {
        const file = await deps.fileService.createNode(
          String(req.params.workspaceId),
          req.user!,
          req.body,
        );
        res.status(201).json({ file });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/workspaces/:workspaceId/files/:fileId',
    requireAuth,
    requireEditor,
    validateBody(updateFileNodeSchema),
    async (req, res, next) => {
      try {
        const file = await deps.fileService.updateNode(
          String(req.params.workspaceId),
          String(req.params.fileId),
          req.user!,
          req.body,
        );
        res.json({ file });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/workspaces/:workspaceId/files/:fileId',
    requireAuth,
    requireEditor,
    async (req, res, next) => {
      try {
        const deletedIds = await deps.fileService.deleteNode(
          String(req.params.workspaceId),
          String(req.params.fileId),
          req.user!,
        );
        res.json({ deletedIds });
      } catch (err) {
        next(err);
      }
    },
  );

  // Save Approval Requests & Version History
  router.post(
    '/workspaces/:workspaceId/files/:fileId/save',
    requireAuth,
    requireEditor,
    validateBody(createChangeRequestSchema),
    async (req, res, next) => {
      try {
        const result = await deps.fileService.submitSave(
          String(req.params.workspaceId),
          String(req.params.fileId),
          req.user!,
          req.workspaceMember!.role,
          req.body,
        );
        res.status(result.mode === 'SAVED' ? 201 : 202).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/workspaces/:workspaceId/change-requests',
    requireAuth,
    requireOwner,
    async (req, res, next) => {
      try {
        const changeRequests = await deps.fileService.listPendingChangeRequests(
          String(req.params.workspaceId),
        );
        res.json({ changeRequests });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/workspaces/:workspaceId/change-requests/:requestId/decide',
    requireAuth,
    requireOwner,
    validateBody(decideChangeRequestSchema),
    async (req, res, next) => {
      try {
        const result = await deps.fileService.decideChangeRequest(
          String(req.params.workspaceId),
          String(req.params.requestId),
          req.user!,
          req.body.decision,
        );
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/workspaces/:workspaceId/files/:fileId/versions',
    requireAuth,
    requireMember,
    async (req, res, next) => {
      try {
        const versions = await deps.fileService.listFileVersions(
          String(req.params.workspaceId),
          String(req.params.fileId),
        );
        res.json({ versions });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/workspaces/:workspaceId/files/:fileId/versions/:versionId/restore',
    requireAuth,
    requireOwner,
    async (req, res, next) => {
      try {
        const version = await deps.fileService.restoreFileVersion(
          String(req.params.workspaceId),
          String(req.params.fileId),
          String(req.params.versionId),
          req.user!,
        );
        res.json({ version });
      } catch (err) {
        next(err);
      }
    },
  );

  // Code execution (hosted sandbox + audit history)
  router.post(
    '/workspaces/:workspaceId/execute',
    requireAuth,
    requireEditor,
    execLimiter,
    validateBody(executeCodeSchema),
    async (req, res, next) => {
      try {
        const result = await deps.executionService.execute(
          String(req.params.workspaceId),
          req.user!,
          req.body,
        );
        res.json({ result });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/workspaces/:workspaceId/executions/record',
    requireAuth,
    requireEditor,
    validateBody(recordClientExecutionSchema),
    async (req, res, next) => {
      try {
        const now = new Date();
        const started = new Date(now.getTime() - req.body.durationMs);
        const rec = await deps.db.executions.create({
          id: generateSecureId('exec'),
          workspaceId: String(req.params.workspaceId),
          fileId: req.body.fileId ?? null,
          userId: req.user!.id,
          language: req.body.language,
          provider: req.body.provider,
          status: req.body.status,
          exitCode: req.body.exitCode,
          stdout: req.body.stdout,
          stderr: req.body.stderr,
          durationMs: req.body.durationMs,
          startedAt: started,
          finishedAt: now,
        });
        res.status(201).json({ record: rec });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/workspaces/:workspaceId/executions',
    requireAuth,
    requireMember,
    async (req, res, next) => {
      try {
        const executions = await deps.db.executions.listByWorkspace(
          String(req.params.workspaceId),
        );
        res.json({ executions });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
