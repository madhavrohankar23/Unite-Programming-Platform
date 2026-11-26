import { z } from 'zod';

const SAFE_NODE_NAME_REGEX = /^[^\\/\0<>:"|?*]+$/;

export function isValidNodeName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 120) return false;
  if (trimmed === '.' || trimmed === '..') return false;
  if (trimmed.includes('..')) return false;
  return SAFE_NODE_NAME_REGEX.test(trimmed);
}

export const registerSchema = z.object({
  email: z.string().trim().email('Enter a valid email address').max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long'),
  displayName: z
    .string()
    .trim()
    .min(2, 'Display name must be at least 2 characters')
    .max(60, 'Display name must be under 60 characters'),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required').max(128),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  avatarUrl: z.string().url().max(500).nullable().optional(),
});

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Workspace name must be at least 2 characters')
    .max(80, 'Workspace name must be under 80 characters'),
  category: z.enum(['programming', 'development', 'custom']).default('programming'),
  defaultLanguage: z.string().trim().min(1).max(32).default('javascript'),
  stack: z.string().trim().min(1).max(40).optional(),
  liveServerEnabled: z.boolean().optional(),
  template: z
    .enum(['node-starter', 'python-starter', 'cpp-starter', 'blank'])
    .optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  defaultLanguage: z.string().trim().min(1).max(32).optional(),
  liveServerEnabled: z.boolean().optional(),
});

export const createInvitationSchema = z.object({
  role: z.enum(['EDITOR', 'VIEWER']).default('EDITOR'),
  expiresInHours: z.number().int().min(1).max(720).nullable().default(72),
  maxUses: z.number().int().min(1).max(1000).nullable().default(null),
});

export const joinWorkspaceSchema = z.object({
  tokenOrCode: z
    .string()
    .trim()
    .min(6, 'Enter a valid 6-digit workspace code or invitation link')
    .max(512),
});

export const submitJoinRequestSchema = z.object({
  joinCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Workspace join code must be a 6-digit number'),
});

export const decideJoinRequestSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  role: z.enum(['EDITOR', 'VIEWER']).default('VIEWER'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['EDITOR', 'VIEWER']),
});

export const createFileNodeSchema = z.object({
  parentId: z.string().min(1).max(64).nullable().default(null),
  name: z
    .string()
    .trim()
    .refine(isValidNodeName, 'Invalid file or folder name (path separators and ".." are disallowed)'),
  nodeType: z.enum(['FILE', 'FOLDER']),
  language: z.string().trim().min(1).max(32).optional(),
  initialContent: z.string().max(500_000).optional(),
});

export const updateFileNodeSchema = z.object({
  name: z
    .string()
    .trim()
    .refine(isValidNodeName, 'Invalid file or folder name')
    .optional(),
  parentId: z.string().min(1).max(64).nullable().optional(),
  language: z.string().trim().min(1).max(32).optional(),
});

export const createChangeRequestSchema = z.object({
  content: z.string().max(500_000),
  summary: z.string().trim().max(200).optional().default('Proposed code update'),
});

export const decideChangeRequestSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
});

export const executeCodeSchema = z.object({
  fileId: z.string().min(1).max(64).nullable().optional(),
  language: z.string().trim().min(1).max(32),
  code: z.string().min(1, 'Cannot execute empty code').max(100_000, 'Code exceeds 100KB limit'),
  stdin: z.string().max(16_384, 'Input exceeds 16KB limit').optional().default(''),
});

export const recordClientExecutionSchema = z.object({
  fileId: z.string().min(1).max(64).nullable().optional(),
  language: z.string().trim().min(1).max(32),
  provider: z.string().trim().min(1).max(40),
  status: z.enum([
    'COMPLETED',
    'COMPILE_ERROR',
    'RUNTIME_ERROR',
    'TIMEOUT',
    'CANCELLED',
    'UNAVAILABLE',
  ]),
  exitCode: z.number().int().nullable(),
  stdout: z.string().max(65_536),
  stderr: z.string().max(65_536),
  durationMs: z.number().int().min(0).max(600_000),
});
