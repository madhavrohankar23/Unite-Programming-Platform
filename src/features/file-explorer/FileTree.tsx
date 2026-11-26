import type { WorkspaceFileDto } from '@shared/types/models';
import {
  ChevronDown,
  ChevronRight,
  Edit3,
  FileCode2,
  FilePlus2,
  Folder,
  FolderOpen,
  FolderPlus,
  Search,
  Trash2,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { useTheme } from '@/features/theme/ThemeContext';
import { cn } from '@/lib/utilities/cn';

interface FileTreeProps {
  files: WorkspaceFileDto[];
  activeFileId: string | null;
  canEdit: boolean;
  onOpenFile: (file: WorkspaceFileDto) => void;
  onCreateNode: (input: {
    parentId: string | null;
    name: string;
    nodeType: 'FILE' | 'FOLDER';
  }) => Promise<void>;
  onRenameNode: (fileId: string, newName: string) => Promise<void>;
  onDeleteNode: (fileId: string) => Promise<void>;
}

interface TreeNode extends WorkspaceFileDto {
  children: TreeNode[];
}

function buildTree(files: WorkspaceFileDto[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const f of files) {
    map.set(f.id, { ...f, children: [] });
  }
  for (const f of files) {
    const node = map.get(f.id)!;
    if (f.parentId && map.has(f.parentId)) {
      map.get(f.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.nodeType !== b.nodeType) return a.nodeType === 'FOLDER' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}

export function FileTree({
  files,
  activeFileId,
  canEdit,
  onOpenFile,
  onCreateNode,
  onRenameNode,
  onDeleteNode,
}: FileTreeProps) {
  const { isLight } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(files.filter((f) => f.nodeType === 'FOLDER').map((f) => f.id)),
  );
  const [creating, setCreating] = useState<{
    parentId: string | null;
    nodeType: 'FILE' | 'FOLDER';
  } | null>(null);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceFileDto | null>(null);
  const [busy, setBusy] = useState(false);

  const tree = useMemo(() => buildTree(files), [files]);

  const filteredFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return files.filter((f) => f.nodeType === 'FILE' && f.name.toLowerCase().includes(q));
  }, [files, searchQuery]);

  function toggleFolder(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    if (!creating || !newName.trim()) return;
    setBusy(true);
    try {
      await onCreateNode({
        parentId: creating.parentId,
        name: newName.trim(),
        nodeType: creating.nodeType,
      });
      if (creating.parentId) {
        setExpandedIds((prev) => new Set(prev).add(creating.parentId!));
      }
      setCreating(null);
      setNewName('');
    } finally {
      setBusy(false);
    }
  }

  async function handleRenameSubmit(e: FormEvent, id: string) {
    e.preventDefault();
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    setBusy(true);
    try {
      await onRenameNode(id, renameValue.trim());
      setRenamingId(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await onDeleteNode(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setBusy(false);
    }
  }

  function renderNode(node: TreeNode, depth: number) {
    const isFolder = node.nodeType === 'FOLDER';
    const isExpanded = expandedIds.has(node.id);
    const isActive = node.id === activeFileId;
    const isRenaming = renamingId === node.id;

    return (
      <div key={node.id}>
        <div
          onClick={() => {
            if (isRenaming) return;
            if (isFolder) toggleFolder(node.id);
            else onOpenFile(node);
          }}
          style={{ paddingLeft: `${depth * 12 + 10}px` }}
          className={cn(
            'group flex h-7 cursor-pointer items-center justify-between pr-2 text-xs transition-colors',
            isActive
              ? isLight
                ? 'bg-black/10 font-semibold text-black'
                : 'bg-[#2563EB]/20 text-[#F8FAFC]'
              : isLight
                ? 'text-zinc-600 hover:bg-black/5 hover:text-black'
                : 'text-[#94A3B8] hover:bg-[#141D2D] hover:text-[#F8FAFC]',
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {isFolder ? (
              <>
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
                )}
                {isExpanded ? (
                  <FolderOpen
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      isLight ? 'text-black' : 'text-[#22D3EE]',
                    )}
                  />
                ) : (
                  <Folder
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      isLight ? 'text-black' : 'text-[#22D3EE]',
                    )}
                  />
                )}
              </>
            ) : (
              <>
                <span className="w-3.5 shrink-0" />
                <FileCode2
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    isActive
                      ? isLight
                        ? 'text-black'
                        : 'text-[#22D3EE]'
                      : 'opacity-60',
                  )}
                />
              </>
            )}

            {isRenaming ? (
              <form
                onSubmit={(e) => void handleRenameSubmit(e, node.id)}
                onClick={(e) => e.stopPropagation()}
                className="flex-1"
              >
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => setRenamingId(null)}
                  autoFocus
                  disabled={busy}
                  className={cn(
                    'h-5 w-full rounded border px-1.5 text-xs focus:outline-none',
                    isLight
                      ? 'border-black bg-white text-black'
                      : 'border-[#2563EB] bg-[#080D17] text-[#F8FAFC]',
                  )}
                />
              </form>
            ) : (
              <span className="truncate">{node.name}</span>
            )}
          </div>

          {canEdit && !isRenaming && (
            <div
              className="hidden items-center gap-0.5 group-hover:flex"
              onClick={(e) => e.stopPropagation()}
            >
              {isFolder && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedIds((prev) => new Set(prev).add(node.id));
                      setCreating({ parentId: node.id, nodeType: 'FILE' });
                      setNewName('');
                    }}
                    className="rounded p-0.5 opacity-60 hover:bg-black/10 hover:opacity-100"
                    title="New file in folder"
                  >
                    <FilePlus2 className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedIds((prev) => new Set(prev).add(node.id));
                      setCreating({ parentId: node.id, nodeType: 'FOLDER' });
                      setNewName('');
                    }}
                    className="rounded p-0.5 opacity-60 hover:bg-black/10 hover:opacity-100"
                    title="New subfolder"
                  >
                    <FolderPlus className="h-3 w-3" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setRenamingId(node.id);
                  setRenameValue(node.name);
                }}
                className="rounded p-0.5 opacity-60 hover:bg-black/10 hover:opacity-100"
                title="Rename"
              >
                <Edit3 className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(node)}
                className="rounded p-0.5 opacity-60 hover:bg-red-500/20 hover:text-red-500 hover:opacity-100"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {isFolder && isExpanded && (
          <div>
            {creating && creating.parentId === node.id && (
              <form
                onSubmit={(e) => void handleCreateSubmit(e)}
                style={{ paddingLeft: `${(depth + 1) * 12 + 24}px` }}
                className="py-1 pr-2"
              >
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onBlur={() => setCreating(null)}
                  placeholder={creating.nodeType === 'FILE' ? 'filename.ts' : 'folder-name'}
                  autoFocus
                  disabled={busy}
                  className={cn(
                    'h-6 w-full rounded border px-2 text-xs focus:outline-none',
                    isLight
                      ? 'border-black bg-white text-black'
                      : 'border-[#2563EB] bg-[#080D17] text-[#F8FAFC]',
                  )}
                />
              </form>
            )}
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-full flex-col',
        isLight
          ? 'bg-gradient-to-b from-zinc-50 to-white text-black'
          : 'bg-[#0E1523] text-[#F8FAFC]',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between border-b px-3 py-2',
          isLight ? 'border-black/10' : 'border-slate-400/10',
        )}
      >
        <span
          className={cn(
            'text-[11px] font-semibold uppercase tracking-wider',
            isLight ? 'text-zinc-500' : 'text-[#94A3B8]',
          )}
        >
          Explorer
        </span>
        {canEdit && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setCreating({ parentId: null, nodeType: 'FILE' });
                setNewName('');
              }}
              className={cn(
                'rounded p-1 transition-colors',
                isLight
                  ? 'text-zinc-600 hover:bg-black/5 hover:text-black'
                  : 'text-[#94A3B8] hover:bg-[#141D2D] hover:text-[#F8FAFC]',
              )}
              title="New File"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating({ parentId: null, nodeType: 'FOLDER' });
                setNewName('');
              }}
              className={cn(
                'rounded p-1 transition-colors',
                isLight
                  ? 'text-zinc-600 hover:bg-black/5 hover:text-black'
                  : 'text-[#94A3B8] hover:bg-[#141D2D] hover:text-[#F8FAFC]',
              )}
              title="New Folder"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <div
        className={cn(
          'border-b px-2.5 py-2',
          isLight ? 'border-black/10' : 'border-slate-400/10',
        )}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 opacity-50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className={cn(
              'h-7 w-full rounded-lg border pl-8 pr-2.5 text-xs focus:outline-none',
              isLight
                ? 'border-black/12 bg-white text-black placeholder:text-zinc-400 focus:border-black'
                : 'border-slate-400/12 bg-[#080D17] text-[#F8FAFC] placeholder:text-[#64748B] focus:border-[#2563EB]',
            )}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1.5">
        {creating && creating.parentId === null && (
          <form onSubmit={(e) => void handleCreateSubmit(e)} className="px-3 py-1">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => setCreating(null)}
              placeholder={creating.nodeType === 'FILE' ? 'filename.ts' : 'folder-name'}
              autoFocus
              disabled={busy}
              className={cn(
                'h-6 w-full rounded border px-2 text-xs focus:outline-none',
                isLight
                  ? 'border-black bg-white text-black'
                  : 'border-[#2563EB] bg-[#080D17] text-[#F8FAFC]',
              )}
            />
          </form>
        )}

        {filteredFiles ? (
          filteredFiles.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs opacity-60">No matching files</p>
          ) : (
            filteredFiles.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => onOpenFile(file)}
                className={cn(
                  'flex h-7 w-full items-center gap-2 px-3 text-left text-xs',
                  file.id === activeFileId
                    ? isLight
                      ? 'bg-black/10 font-semibold text-black'
                      : 'bg-[#2563EB]/20 text-[#F8FAFC]'
                    : isLight
                      ? 'text-zinc-600 hover:bg-black/5 hover:text-black'
                      : 'text-[#94A3B8] hover:bg-[#141D2D] hover:text-[#F8FAFC]',
                )}
              >
                <FileCode2
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    isLight ? 'text-black' : 'text-[#22D3EE]',
                  )}
                />
                <span className="truncate">{file.name}</span>
              </button>
            ))
          )
        ) : tree.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs opacity-60">
            Workspace is empty. Create a file to start coding.
          </p>
        ) : (
          tree.map((node) => renderNode(node, 0))
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete "${deleteTarget?.name ?? ''}"?`}
        description={
          deleteTarget?.nodeType === 'FOLDER'
            ? 'This will permanently delete the folder and all files inside it.'
            : 'This will permanently delete the file and its collaborative document.'
        }
        confirmLabel="Delete"
        danger
        loading={busy}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
