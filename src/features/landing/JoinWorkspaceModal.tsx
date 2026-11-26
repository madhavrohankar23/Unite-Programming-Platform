import type { WorkspaceJoinRequestDto } from '@shared/types/models';
import { Clock, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/feedback/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/features/authentication/AuthContext';
import { useUserNotifications } from '@/features/collaboration/useUserNotifications';
import { useTheme } from '@/features/theme/ThemeContext';
import { cn } from '@/lib/utilities/cn';
import { workspacesApi } from '@/services/api/workspacesApi';

interface JoinWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCode?: string;
}

export function JoinWorkspaceModal({
  open,
  onOpenChange,
  initialCode = '',
}: JoinWorkspaceModalProps) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { accessToken } = useAuth();
  const { isLight } = useTheme();

  const [codeInput, setCodeInput] = useState(initialCode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<WorkspaceJoinRequestDto | null>(null);
  const [rejectedMsg, setRejectedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialCode) setCodeInput(initialCode);
  }, [initialCode]);

  // Listen in real time for host approval or rejection while waiting
  useUserNotifications(accessToken, Boolean(pendingRequest), (event) => {
    if (event.type === 'join:decided' && pendingRequest && event.request.id === pendingRequest.id) {
      if (event.request.status === 'APPROVED') {
        notify({
          kind: 'success',
          title: `Approved for "${event.request.workspaceName}"`,
          description: `Granted role: ${event.request.assignedRole ?? 'VIEWER'}`,
        });
        setPendingRequest(null);
        onOpenChange(false);
        navigate(`/workspace/${event.request.workspaceId}`);
      } else if (event.request.status === 'REJECTED') {
        setPendingRequest(null);
        setRejectedMsg('The workspace host declined your join request.');
      }
    }
  });

  // Safety fallback check if notification arrived during WS reconnect
  useEffect(() => {
    if (!pendingRequest) return;
    const reqId = pendingRequest.id;
    const interval = window.setInterval(async () => {
      try {
        const { request } = await workspacesApi.getJoinRequestStatus(reqId);
        if (request.status === 'APPROVED') {
          window.clearInterval(interval);
          setPendingRequest(null);
          onOpenChange(false);
          notify({
            kind: 'success',
            title: `Approved for "${request.workspaceName}"`,
            description: `Granted role: ${request.assignedRole ?? 'VIEWER'}`,
          });
          navigate(`/workspace/${request.workspaceId}`);
        } else if (request.status === 'REJECTED') {
          window.clearInterval(interval);
          setPendingRequest(null);
          setRejectedMsg('The workspace host declined your join request.');
        }
      } catch {
        // ignore transient network check
      }
    }, 3500);

    return () => window.clearInterval(interval);
  }, [pendingRequest, navigate, notify, onOpenChange]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cleaned = codeInput.trim();
    if (!cleaned) return;
    setError(null);
    setRejectedMsg(null);
    setSubmitting(true);

    try {
      // 6-digit workspace code -> enters host approval waiting room
      if (/^\d{6}$/.test(cleaned)) {
        const res = await workspacesApi.submitJoinRequest(cleaned);
        if (res.alreadyMember) {
          notify({ kind: 'success', title: `Rejoined "${res.workspace.name}"` });
          onOpenChange(false);
          navigate(`/workspace/${res.workspace.id}`);
          return;
        }
        setPendingRequest(res.request);
        notify({
          kind: 'info',
          title: 'Join request sent to host',
          description: 'Waiting for admin to assign Edit or Read-Only access.',
        });
        return;
      }

      // Signed invitation URL or token
      const { workspace } = await workspacesApi.joinWorkspace(cleaned);
      notify({
        kind: 'success',
        title: `Joined "${workspace.name}"`,
        description: `Role: ${workspace.currentUserRole}`,
      });
      onOpenChange(false);
      navigate(`/workspace/${workspace.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join workspace');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setPendingRequest(null);
          setRejectedMsg(null);
          setError(null);
        }
        onOpenChange(next);
      }}
      title={pendingRequest ? 'Waiting for Host Approval' : 'Join Workspace'}
      description={
        pendingRequest
          ? `Your request to join "${pendingRequest.workspaceName}" has been sent to the workspace host.`
          : 'Enter the unique 6-digit workspace code shared by the host.'
      }
    >
      {pendingRequest ? (
        <div className="space-y-4 py-2 text-center">
          <div
            className={cn(
              'mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border',
              isLight
                ? 'border-black/15 bg-zinc-100 text-black'
                : 'border-[#22D3EE]/30 bg-[#22D3EE]/10 text-[#22D3EE]',
            )}
          >
            <Clock className="h-7 w-7 animate-pulse" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">Pending Admin Decision</p>
            <p className={cn('text-xs', isLight ? 'text-zinc-600' : 'text-[#94A3B8]')}>
              The host will choose whether you enter in <strong>Edit Mode</strong> or{' '}
              <strong>Read-Only Mode</strong>. You will enter automatically once approved.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setPendingRequest(null);
              onOpenChange(false);
            }}
          >
            Cancel Waiting
          </Button>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {error && (
            <div className="rounded-xl border border-[#EF4444]/35 bg-[#EF4444]/10 px-3 py-2 text-xs text-[#FCA5A5]">
              {error}
            </div>
          )}

          {rejectedMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-[#F59E0B]/35 bg-[#F59E0B]/10 px-3 py-2 text-xs text-amber-400">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{rejectedMsg}</span>
            </div>
          )}

          <Input
            label="6-Digit Workspace Code (or Invite Link)"
            required
            placeholder="e.g. 482910"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            className="text-center font-mono text-base tracking-[0.25em]"
            autoFocus
          />

          <div
            className={cn(
              'flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px]',
              isLight
                ? 'border-black/10 bg-zinc-50 text-zinc-600'
                : 'border-slate-400/12 bg-[#080D17]/70 text-[#94A3B8]',
            )}
          >
            <ShieldCheck
              className={cn('h-4 w-4 shrink-0', isLight ? 'text-black' : 'text-[#22D3EE]')}
            />
            <span>
              Joining with a 6-digit code notifies the workspace host to approve your access mode.
            </span>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={submitting}>
              Request Access
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
