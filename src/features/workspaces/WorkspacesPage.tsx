import type { WorkspaceSummaryDto } from '@shared/types/models';
import { ArrowRight, Code2, Hash, LogIn, LogOut, Plus, Trash2, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UniteLogo } from '@/components/common/UniteLogo';
import { UserAvatar } from '@/components/common/UserAvatar';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { useToast } from '@/components/feedback/ToastContext';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/authentication/AuthContext';
import { CreateWorkspaceModal } from '@/features/landing/CreateWorkspaceModal';
import { JoinWorkspaceModal } from '@/features/landing/JoinWorkspaceModal';
import { useTheme } from '@/features/theme/ThemeContext';
import { ThemeToggle } from '@/features/theme/ThemeToggle';
import { cn } from '@/lib/utilities/cn';
import { workspacesApi } from '@/services/api/workspacesApi';

export function WorkspacesPage() {
  const { user, logout } = useAuth();
  const { isLight } = useTheme();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [workspaces, setWorkspaces] = useState<WorkspaceSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceSummaryDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    try {
      const { workspaces: list } = await workspacesApi.list();
      setWorkspaces(list);
    } catch (err) {
      notify({
        kind: 'error',
        title: 'Failed to load workspaces',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void fetchWorkspaces();
  }, [fetchWorkspaces]);

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await workspacesApi.delete(deleteTarget.id);
      setWorkspaces((prev) => prev.filter((w) => w.id !== deleteTarget.id));
      notify({ kind: 'success', title: `Deleted "${deleteTarget.name}"` });
      setDeleteTarget(null);
    } catch (err) {
      notify({
        kind: 'error',
        title: 'Could not delete workspace',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className={cn(
        'min-h-screen transition-colors duration-300',
        isLight ? 'unite-light-canvas text-black' : 'bg-[#080D17] text-[#F8FAFC]',
      )}
    >
      <header
        className={cn(
          'border-b backdrop-blur-md',
          isLight
            ? 'unite-light-surface border-black/10'
            : 'border-slate-400/12 bg-[#0E1523]/80',
        )}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link to="/" className="flex items-center gap-2.5">
            <UniteLogo size="sm" />
            <span className="text-base font-bold tracking-tight">Unite</span>
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle compact />
            {user && (
              <div className="flex items-center gap-2 text-xs opacity-80">
                <UserAvatar userId={user.id} displayName={user.displayName} size="xs" />
                <span className="hidden sm:inline">{user.displayName}</span>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Your Workspaces</h1>
            <p className={cn('mt-1 text-sm', isLight ? 'text-zinc-600' : 'text-[#94A3B8]')}>
              Open an existing collaborative IDE workspace or start a new one.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="secondary" size="md" onClick={() => setJoinOpen(true)}>
              <LogIn className="h-4 w-4 opacity-70" />
              Join Workspace
            </Button>
            <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Create Workspace
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  'h-40 animate-pulse rounded-2xl border',
                  isLight ? 'border-black/10 bg-zinc-100' : 'border-slate-400/10 bg-[#0E1523]',
                )}
              />
            ))}
          </div>
        ) : workspaces.length === 0 ? (
          <div
            className={cn(
              'flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center',
              isLight ? 'border-black/20 bg-white/80' : 'border-slate-400/20 bg-[#0E1523]/50',
            )}
          >
            <Code2 className={cn('mb-3 h-10 w-10', isLight ? 'text-black' : 'text-[#22D3EE]')} />
            <h2 className="text-base font-semibold">No workspaces yet</h2>
            <p
              className={cn(
                'mt-1 max-w-sm text-sm',
                isLight ? 'text-zinc-600' : 'text-[#94A3B8]',
              )}
            >
              Create your first collaborative workspace or join a teammate using a 6-digit code.
            </p>
            <div className="mt-5 flex gap-3">
              <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Create Workspace
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setJoinOpen(true)}>
                Join Workspace
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                className={cn(
                  'group flex flex-col justify-between rounded-2xl border p-5 transition-all',
                  isLight
                    ? 'unite-light-card border-black/10 hover:border-black/30'
                    : 'border-slate-400/12 bg-[#0E1523] hover:border-[#2563EB]/40 hover:bg-[#141D2D]',
                )}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate text-base font-semibold">{ws.name}</h3>
                    <span
                      className={cn(
                        'shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                        isLight
                          ? 'border-black/15 bg-black text-white'
                          : 'border-slate-400/15 bg-[#080D17] text-[#22D3EE]',
                      )}
                    >
                      {ws.currentUserRole}
                    </span>
                  </div>
                  <div
                    className={cn(
                      'mt-3 flex flex-wrap items-center gap-3 text-xs',
                      isLight ? 'text-zinc-600' : 'text-[#94A3B8]',
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 opacity-60" />
                      {ws.memberCount}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Code2 className="h-3.5 w-3.5 opacity-60" />
                      {ws.fileCount} files
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono font-semibold">
                      <Hash className="h-3 w-3 opacity-60" />
                      {ws.joinCode}
                    </span>
                  </div>
                </div>

                <div
                  className={cn(
                    'mt-5 flex items-center justify-between border-t pt-3.5',
                    isLight ? 'border-black/10' : 'border-slate-400/10',
                  )}
                >
                  {ws.currentUserRole === 'OWNER' ? (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(ws)}
                      className="rounded-lg p-1.5 opacity-60 transition-colors hover:bg-red-500/15 hover:text-red-500 hover:opacity-100"
                      title="Delete workspace"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="text-[11px] opacity-60 capitalize">{ws.category}</span>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/workspace/${ws.id}`)}
                  >
                    Open IDE
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <CreateWorkspaceModal open={createOpen} onOpenChange={setCreateOpen} />
      <JoinWorkspaceModal open={joinOpen} onOpenChange={setJoinOpen} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete "${deleteTarget?.name ?? ''}"?`}
        description="This permanently deletes all files, collaborative document history, and member access for this workspace."
        confirmLabel="Delete Workspace"
        danger
        loading={deleting}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
