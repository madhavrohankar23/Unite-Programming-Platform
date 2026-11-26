import type { FileChangeRequestDto, WorkspaceJoinRequestDto } from '@shared/types/models';
import { Check, Eye, FileDiff, Pencil, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/features/theme/ThemeContext';
import { cn } from '@/lib/utilities/cn';

interface ApprovalPopupsProps {
  joinRequests: WorkspaceJoinRequestDto[];
  changeRequests: FileChangeRequestDto[];
  onDecideJoin: (requestId: string, decision: 'APPROVE' | 'REJECT', role: 'EDITOR' | 'VIEWER') => Promise<void>;
  onDecideChange: (requestId: string, decision: 'APPROVE' | 'REJECT') => Promise<void>;
}

export function ApprovalPopups({
  joinRequests,
  changeRequests,
  onDecideJoin,
  onDecideChange,
}: ApprovalPopupsProps) {
  const { isLight } = useTheme();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedDiffId, setExpandedDiffId] = useState<string | null>(null);

  if (joinRequests.length === 0 && changeRequests.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-4 top-14 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2.5">
      {/* Pending User Join Approvals */}
      {joinRequests.map((req) => (
        <div
          key={req.id}
          className={cn(
            'rounded-2xl border p-4 shadow-2xl backdrop-blur-xl transition-all',
            isLight
              ? 'border-black/15 bg-white/95 text-black shadow-[0_18px_48px_rgba(0,0,0,0.16)]'
              : 'border-[#22D3EE]/30 bg-[#0E1523]/95 text-[#F8FAFC] shadow-unite-panel',
          )}
        >
          <div className="flex items-start gap-3">
            <UserAvatar userId={req.userId} displayName={req.user.displayName} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <UserPlus className={cn('h-3.5 w-3.5', isLight ? 'text-black' : 'text-[#22D3EE]')} />
                <span>Join Request</span>
              </div>
              <p className="mt-0.5 truncate text-xs font-medium">{req.user.displayName}</p>
              <p className={cn('truncate text-[11px]', isLight ? 'text-zinc-500' : 'text-[#94A3B8]')}>
                {req.user.email} wants to join
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-end gap-1.5">
            <Button
              size="sm"
              variant="danger"
              disabled={busyId === req.id}
              onClick={async () => {
                setBusyId(req.id);
                try {
                  await onDecideJoin(req.id, 'REJECT', 'VIEWER');
                } finally {
                  setBusyId(null);
                }
              }}
            >
              <X className="h-3 w-3" />
              Decline
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busyId === req.id}
              onClick={async () => {
                setBusyId(req.id);
                try {
                  await onDecideJoin(req.id, 'APPROVE', 'VIEWER');
                } finally {
                  setBusyId(null);
                }
              }}
            >
              <Eye className="h-3 w-3" />
              Read-Only
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={busyId === req.id}
              onClick={async () => {
                setBusyId(req.id);
                try {
                  await onDecideJoin(req.id, 'APPROVE', 'EDITOR');
                } finally {
                  setBusyId(null);
                }
              }}
            >
              <Pencil className="h-3 w-3" />
              Edit Mode
            </Button>
          </div>
        </div>
      ))}

      {/* Pending Save / Code Change Approvals */}
      {changeRequests.map((cr) => {
        const showingDiff = expandedDiffId === cr.id;
        return (
          <div
            key={cr.id}
            className={cn(
              'rounded-2xl border p-4 shadow-2xl backdrop-blur-xl transition-all',
              isLight
                ? 'border-black/15 bg-white/95 text-black shadow-[0_18px_48px_rgba(0,0,0,0.16)]'
                : 'border-[#2563EB]/40 bg-[#0E1523]/95 text-[#F8FAFC] shadow-unite-panel',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <FileDiff
                    className={cn('h-3.5 w-3.5', isLight ? 'text-black' : 'text-[#22D3EE]')}
                  />
                  <span>Save Approval Request</span>
                </div>
                <p className="mt-1 text-xs">
                  <strong>{cr.authorName}</strong> wants to save{' '}
                  <code className="font-mono font-semibold">{cr.fileName}</code>
                </p>
                <p className={cn('mt-0.5 text-[11px]', isLight ? 'text-zinc-500' : 'text-[#94A3B8]')}>
                  {cr.summary}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpandedDiffId(showingDiff ? null : cr.id)}
                className={cn(
                  'shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium',
                  isLight ? 'bg-zinc-100 text-black hover:bg-zinc-200' : 'bg-[#141D2D] text-[#22D3EE]',
                )}
              >
                {showingDiff ? 'Hide Code' : 'Preview'}
              </button>
            </div>

            {showingDiff && (
              <pre
                className={cn(
                  'mt-2.5 max-h-40 overflow-auto rounded-xl border p-2.5 font-mono text-[11px]',
                  isLight
                    ? 'border-black/10 bg-zinc-50 text-zinc-900'
                    : 'border-slate-400/15 bg-[#080D17] text-[#E2E8F0]',
                )}
              >
                {cr.proposedContent}
              </pre>
            )}

            <div className="mt-3 flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="danger"
                disabled={busyId === cr.id}
                onClick={async () => {
                  setBusyId(cr.id);
                  try {
                    await onDecideChange(cr.id, 'REJECT');
                  } finally {
                    setBusyId(null);
                  }
                }}
              >
                <X className="h-3 w-3" />
                Reject
              </Button>
              <Button
                size="sm"
                variant="primary"
                loading={busyId === cr.id}
                onClick={async () => {
                  setBusyId(cr.id);
                  try {
                    await onDecideChange(cr.id, 'APPROVE');
                  } finally {
                    setBusyId(null);
                  }
                }}
              >
                <Check className="h-3 w-3" />
                Accept Changes
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

