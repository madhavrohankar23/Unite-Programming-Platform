import { Check, Copy, Hash, Plus, Shield, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/feedback/ToastContext';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useTheme } from '@/features/theme/ThemeContext';
import { cn } from '@/lib/utilities/cn';
import { workspacesApi } from '@/services/api/workspacesApi';
import type { CreatedInvitationDto, WorkspaceInvitationDto } from '@shared/types/models';

interface ShareWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
  joinCode: string;
}

export function ShareWorkspaceModal({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
  joinCode,
}: ShareWorkspaceModalProps) {
  const { notify } = useToast();
  const { isLight } = useTheme();
  const [role, setRole] = useState<'EDITOR' | 'VIEWER'>('EDITOR');
  const [expiresInHours, setExpiresInHours] = useState<number>(72);
  const [invitations, setInvitations] = useState<WorkspaceInvitationDto[]>([]);
  const [latestCreated, setLatestCreated] = useState<CreatedInvitationDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadInvitations = useCallback(async () => {
    setLoading(true);
    try {
      const { invitations: list } = await workspacesApi.listInvitations(workspaceId);
      setInvitations(list);
    } catch (err) {
      notify({
        kind: 'error',
        title: 'Failed to load invitations',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [workspaceId, notify]);

  useEffect(() => {
    if (open) {
      void loadInvitations();
    }
  }, [open, loadInvitations]);

  async function handleGenerate() {
    setCreating(true);
    try {
      const { invitation } = await workspacesApi.createInvitation(workspaceId, {
        role,
        expiresInHours,
        maxUses: null,
      });
      setLatestCreated(invitation);
      setInvitations((prev) => [invitation, ...prev]);
      notify({ kind: 'success', title: 'Direct invite link created' });
    } catch (err) {
      notify({
        kind: 'error',
        title: 'Could not create invitation',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(invId: string) {
    try {
      await workspacesApi.revokeInvitation(workspaceId, invId);
      setInvitations((prev) =>
        prev.map((inv) =>
          inv.id === invId ? { ...inv, revokedAt: new Date().toISOString() } : inv,
        ),
      );
      if (latestCreated?.id === invId) setLatestCreated(null);
      notify({ kind: 'info', title: 'Invitation revoked' });
    } catch (err) {
      notify({
        kind: 'error',
        title: 'Failed to revoke invitation',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    notify({ kind: 'success', title: 'Copied to clipboard' });
    setTimeout(() => setCopiedKey(null), 1800);
  }

  const inviteUrl = latestCreated
    ? `${window.location.origin}/join?code=${encodeURIComponent(latestCreated.joinCode)}`
    : '';

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Share "${workspaceName}"`}
      description="Share the 6-digit workspace code (requires host approval) or generate a direct role link."
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-4">
        {/* Unique 6-Digit Host-Approved Workspace Code */}
        <div
          className={cn(
            'rounded-xl border p-4',
            isLight
              ? 'border-black/15 bg-gradient-to-b from-zinc-50 to-white'
              : 'border-[#22D3EE]/30 bg-[#080D17]/80',
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <Hash className={cn('h-3.5 w-3.5', isLight ? 'text-black' : 'text-[#22D3EE]')} />
                <span>6-Digit Workspace Join Code</span>
              </div>
              <p className={cn('mt-0.5 text-[11px]', isLight ? 'text-zinc-500' : 'text-[#94A3B8]')}>
                Teammates wait for your popup approval to choose Edit or Read-Only mode.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void copyText(joinCode, '6digit')}
            >
              {copiedKey === '6digit' ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              Copy
            </Button>
          </div>
          <div
            className={cn(
              'mt-3 rounded-xl border py-2.5 text-center font-mono text-2xl font-bold tracking-[0.4em]',
              isLight
                ? 'border-black/10 bg-white text-black'
                : 'border-slate-400/15 bg-[#0E1523] text-[#22D3EE]',
            )}
          >
            {joinCode}
          </div>
        </div>

        {/* Optional direct signed invitation links */}
        <div
          className={cn(
            'grid grid-cols-2 gap-3 rounded-xl border p-3',
            isLight
              ? 'border-black/10 bg-zinc-50'
              : 'border-slate-400/12 bg-[#080D17]/70',
          )}
        >
          <div>
            <label className="mb-1 block text-[11px] font-medium opacity-75">
              Direct Link Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'EDITOR' | 'VIEWER')}
              className={cn(
                'h-9 w-full rounded-lg border px-2.5 text-xs focus:outline-none',
                isLight
                  ? 'border-black/15 bg-white text-black'
                  : 'border-slate-400/15 bg-[#0E1523] text-[#F8FAFC]',
              )}
            >
              <option value="EDITOR">Editor (Edit, Run & Terminal)</option>
              <option value="VIEWER">Viewer (Read-only Observer)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium opacity-75">
              Expiration
            </label>
            <select
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(Number(e.target.value))}
              className={cn(
                'h-9 w-full rounded-lg border px-2.5 text-xs focus:outline-none',
                isLight
                  ? 'border-black/15 bg-white text-black'
                  : 'border-slate-400/15 bg-[#0E1523] text-[#F8FAFC]',
              )}
            >
              <option value={24}>24 hours</option>
              <option value={72}>3 days</option>
              <option value={168}>7 days</option>
            </select>
          </div>
          <div className="col-span-2">
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              loading={creating}
              onClick={() => void handleGenerate()}
            >
              <Plus className="h-3.5 w-3.5" />
              Generate Direct Invite Link
            </Button>
          </div>
        </div>

        {latestCreated && (
          <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-500">
                Direct {latestCreated.role} Link Ready
              </span>
              <span className="text-[11px] opacity-70">Shown once</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-black/10 px-2.5 py-1.5 font-mono text-xs">
                {inviteUrl}
              </code>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void copyText(inviteUrl, 'link')}
              >
                {copiedKey === 'link' ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                Link
              </Button>
            </div>
          </div>
        )}

        <div>
          <h3 className="mb-2 text-xs font-semibold opacity-75">
            Direct Invitations
          </h3>
          <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
            {loading && invitations.length === 0 && (
              <p className="text-xs opacity-60">Loading invitations...</p>
            )}
            {!loading && invitations.length === 0 && (
              <p className="text-xs opacity-60">No direct invite links created yet.</p>
            )}
            {invitations.map((inv) => {
              const revoked = Boolean(inv.revokedAt);
              const expired =
                inv.expiresAt !== null && new Date(inv.expiresAt).getTime() <= Date.now();
              return (
                <div
                  key={inv.id}
                  className={cn(
                    'flex items-center justify-between rounded-lg border px-3 py-2 text-xs',
                    isLight
                      ? 'border-black/10 bg-zinc-50'
                      : 'border-slate-400/10 bg-[#080D17]/60',
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Shield className="h-3.5 w-3.5 opacity-70" />
                    <div>
                      <div className="font-mono">{inv.codePrefix}-••••</div>
                      <div className="text-[11px] opacity-65">
                        {inv.role} • {inv.useCount} joins
                        {revoked ? ' • Revoked' : expired ? ' • Expired' : ''}
                      </div>
                    </div>
                  </div>
                  {!revoked && !expired && (
                    <button
                      type="button"
                      onClick={() => void handleRevoke(inv.id)}
                      className="rounded p-1.5 opacity-60 hover:bg-red-500/15 hover:text-red-500 hover:opacity-100"
                      title="Revoke invitation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
