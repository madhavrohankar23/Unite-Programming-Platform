import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { useToast } from '@/components/feedback/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { EditorSettings } from '@/features/editor/CollaborativeMonacoEditor';
import { useTheme } from '@/features/theme/ThemeContext';
import { cn } from '@/lib/utilities/cn';
import { workspacesApi } from '@/services/api/workspacesApi';

interface WorkspaceSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
  isOwner: boolean;
  editorSettings: EditorSettings;
  onEditorSettingsChange: (next: EditorSettings) => void;
  onWorkspaceRenamed: (newName: string) => void;
}

export function WorkspaceSettingsModal({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
  isOwner,
  editorSettings,
  onEditorSettingsChange,
  onWorkspaceRenamed,
}: WorkspaceSettingsModalProps) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { isLight } = useTheme();
  const [name, setName] = useState(workspaceName);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSaveWorkspace(e: FormEvent) {
    e.preventDefault();
    if (!isOwner || !name.trim()) return;
    setSaving(true);
    try {
      await workspacesApi.update(workspaceId, { name: name.trim() });
      onWorkspaceRenamed(name.trim());
      notify({ kind: 'success', title: 'Workspace updated' });
      onOpenChange(false);
    } catch (err) {
      notify({
        kind: 'error',
        title: 'Failed to update workspace',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteWorkspace() {
    setDeleting(true);
    try {
      await workspacesApi.delete(workspaceId);
      notify({ kind: 'info', title: 'Workspace deleted' });
      navigate('/workspaces', { replace: true });
    } catch (err) {
      notify({
        kind: 'error',
        title: 'Failed to delete workspace',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Workspace & Editor Settings"
        description="Customize your Monaco editor preferences and workspace configuration."
      >
        <div className="space-y-5">
          <div
            className={cn(
              'space-y-3 rounded-xl border p-3.5',
              isLight
                ? 'border-black/10 bg-zinc-50'
                : 'border-slate-400/12 bg-[#080D17]/70',
            )}
          >
            <h3 className="text-xs font-semibold">Editor Preferences</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="mb-1 block opacity-75">Font Size</label>
                <select
                  value={editorSettings.fontSize}
                  onChange={(e) =>
                    onEditorSettingsChange({ ...editorSettings, fontSize: Number(e.target.value) })
                  }
                  className={cn(
                    'h-8 w-full rounded-lg border px-2',
                    isLight
                      ? 'border-black/15 bg-white text-black'
                      : 'border-slate-400/15 bg-[#0E1523] text-[#F8FAFC]',
                  )}
                >
                  {[12, 13, 14, 15, 16, 18].map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}px
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block opacity-75">Word Wrap</label>
                <select
                  value={editorSettings.wordWrap}
                  onChange={(e) =>
                    onEditorSettingsChange({
                      ...editorSettings,
                      wordWrap: e.target.value as 'on' | 'off',
                    })
                  }
                  className={cn(
                    'h-8 w-full rounded-lg border px-2',
                    isLight
                      ? 'border-black/15 bg-white text-black'
                      : 'border-slate-400/15 bg-[#0E1523] text-[#F8FAFC]',
                  )}
                >
                  <option value="on">On</option>
                  <option value="off">Off</option>
                </select>
              </div>
            </div>
            <label className="flex cursor-pointer items-center justify-between pt-1 text-xs">
              <span>Show Editor Minimap</span>
              <input
                type="checkbox"
                checked={editorSettings.minimap}
                onChange={(e) =>
                  onEditorSettingsChange({ ...editorSettings, minimap: e.target.checked })
                }
                className="h-4 w-4 accent-black"
              />
            </label>
          </div>

          {isOwner && (
            <form onSubmit={(e) => void handleSaveWorkspace(e)} className="space-y-3">
              <Input
                label="Workspace Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
              />
              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete Workspace
                </Button>
                <Button type="submit" variant="primary" size="sm" loading={saving}>
                  Save Changes
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${workspaceName}"?`}
        description="All files, collaboration history, and member permissions will be permanently destroyed."
        confirmLabel="Delete Permanently"
        danger
        loading={deleting}
        onConfirm={handleDeleteWorkspace}
      />
    </>
  );
}
