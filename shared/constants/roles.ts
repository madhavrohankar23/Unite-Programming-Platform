export type WorkspaceRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export const WORKSPACE_ROLES: readonly WorkspaceRole[] = ['OWNER', 'EDITOR', 'VIEWER'];

export function canEditFiles(role: WorkspaceRole): boolean {
  return role === 'OWNER' || role === 'EDITOR';
}

export function canExecuteCode(role: WorkspaceRole): boolean {
  return role === 'OWNER' || role === 'EDITOR';
}

export function canUseTerminal(role: WorkspaceRole): boolean {
  return role === 'OWNER' || role === 'EDITOR';
}

export function canManageInvitations(role: WorkspaceRole): boolean {
  return role === 'OWNER' || role === 'EDITOR';
}

export function canManageMembers(role: WorkspaceRole): boolean {
  return role === 'OWNER';
}

export function canUpdateWorkspace(role: WorkspaceRole): boolean {
  return role === 'OWNER';
}

export function canDeleteWorkspace(role: WorkspaceRole): boolean {
  return role === 'OWNER';
}

