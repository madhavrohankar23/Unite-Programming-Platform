import type { FileVersionDto } from '@shared/types/models';
import { History, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/feedback/ToastContext';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useTheme } from '@/features/theme/ThemeContext';
import { cn } from '@/lib/utilities/cn';
import { filesApi } from '@/services/api/filesApi';

interface VersionHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  fileId: string | null;
  fileName: string | null;
  isOwner: boolean;
}

export function VersionHistoryModal({
  open,
  onOpenChange,
  workspaceId,
  fileId,
  fileName,
  isOwner,
}: VersionHistoryModalProps) {
  const { isLight } = useTheme();
  const { notify } = useToast();
  const [versions, setVersions] = useState<FileVersionDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const loadVersions = useCallback(async () => {
    if (!fileId) return;
    setLoading(true);
    try {
      const { versions: list } = await filesApi.listVersions(workspaceId, fileId);
      setVersions(list);
      setSelectedId(list[0]?.id ?? null);
    } catch (err) {
      notify({
        kind: 'error',
        title: 'Failed to load version history',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [workspaceId, fileId, notify]);

  useEffect(() => {
    if (open && fileId) {
      void loadVersions();
    }
  }, [open, fileId, loadVersions]);

  const selected = versions.find((v) => v.id === selectedId) ?? versions[0] ?? null;

  async function handleRestore(versionId: string) {
    if (!fileId) return;
    setRestoring(true);
    try {
      const { version } = await filesApi.restoreVersion(workspaceId, fileId, versionId);
      setVersions((prev) => [version, ...prev]);
      setSelectedId(version.id);
      notify({
        kind: 'success',
        title: `Restored "${fileName}" to v${selected?.versionNumber ?? ''}`,
      });
    } catch (err) {
      notify({
        kind: 'error',
        title: 'Restore failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setRestoring(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Version History — ${fileName ?? 'File'}`}
      description="View previously saved and host-approved snapshots of this file."
      maxWidthClass="max-w-3xl"
    >
      {loading ? (
        <div className="py-12 text-center text-xs text-[var(--unite-text-secondary)]">
          Loading saved versions...
        </div>
      ) : versions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <History className="mb-2.5 h-8 w-8 opacity-40" />
          <p className="text-sm font-medium">No saved versions yet</p>
          <p className="mt-1 text-xs text-[var(--unite-text-secondary)]">
            Click <strong>Save</strong> in the editor toolbar (and get host approval if you are an Editor) to create version snapshots.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
          <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
            {versions.map((v) => {
              const active = v.id === selected?.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedId(v.id)}
                  className={cn(
                    'w-full rounded-xl border p-2.5 text-left transition-all',
                    active
                      ? isLight
                        ? 'border-black bg-zinc-100 text-black'
                        : 'border-[#22D3EE]/50 bg-[#141D2D] text-[#F8FAFC]'
                      : isLight
                        ? 'border-black/10 bg-white text-zinc-700 hover:bg-zinc-50'
                        : 'border-slate-400/12 bg-[#080D17]/70 text-[#94A3B8] hover:bg-[#141D2D]/60',
                  )}
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>Version {v.versionNumber}</span>
                    <span className="text-[10px] font-normal opacity-75">
                      {new Date(v.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[11px] opacity-85">{v.summary}</div>
                  <div className="mt-1 text-[10px] opacity-65">
                    By {v.authorName} • Approved by {v.approvedByName}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--unite-border)]">
            {selected && (
              <>
                <div
                  className={cn(
                    'flex items-center justify-between border-b px-3 py-2 text-xs',
                    isLight
                      ? 'border-black/10 bg-zinc-50 text-black'
                      : 'border-slate-400/12 bg-[#080D17] text-[#F8FAFC]',
                  )}
                >
                  <span>
                    <strong>v{selected.versionNumber}</strong> — {selected.authorName}
                  </span>
                  {isOwner && (
                    <Button
                      size="sm"
                      variant="primary"
                      loading={restoring}
                      onClick={() => void handleRestore(selected.id)}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restore
                    </Button>
                  )}
                </div>
                <pre
                  className={cn(
                    'max-h-80 flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed',
                    isLight ? 'bg-white text-black' : 'bg-[#080D17] text-[#E2E8F0]',
                  )}
                >
                  {selected.content}
                </pre>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

