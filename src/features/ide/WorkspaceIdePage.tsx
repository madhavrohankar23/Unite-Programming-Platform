import {
  getLanguageById,
  SUPPORTED_LANGUAGES,
} from '@shared/constants/languages';
import {
  canEditFiles,
  canExecuteCode,
  canManageInvitations,
  canUseTerminal,
} from '@shared/constants/roles';
import type {
  ExecutionResultDto,
  FileChangeRequestDto,
  WorkspaceDto,
  WorkspaceEventPayload,
  WorkspaceFileDto,
  WorkspaceJoinRequestDto,
} from '@shared/types/models';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Code2,
  Files,
  Globe,
  Hash,
  History,
  Menu,
  Play,
  Save,
  Settings,
  Share2,
  Square,
  Terminal,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { UniteLogo } from '@/components/common/UniteLogo';
import { UserAvatar } from '@/components/common/UserAvatar';
import { FullScreenLoader } from '@/components/feedback/FullScreenLoader';
import { useToast } from '@/components/feedback/ToastContext';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/authentication/AuthContext';
import {
  useCollabDocument,
  type CollabConnectionStatus,
} from '@/features/collaboration/useCollabDocument';
import { useWorkspaceEvents } from '@/features/collaboration/useWorkspaceEvents';
import {
  CollaborativeMonacoEditor,
  type EditorSettings,
} from '@/features/editor/CollaborativeMonacoEditor';
import { EditorTabs } from '@/features/editor/EditorTabs';
import { runWorkspaceCode } from '@/features/execution/executionManager';
import { FileTree } from '@/features/file-explorer/FileTree';
import {
  CollaboratorsSidebar,
  type ChatMessageItem,
} from '@/features/presence/CollaboratorsSidebar';
import { TerminalPanel } from '@/features/terminal/TerminalPanel';
import { useTheme } from '@/features/theme/ThemeContext';
import { ThemeToggle } from '@/features/theme/ThemeToggle';
import { ShareWorkspaceModal } from '@/features/workspaces/ShareWorkspaceModal';
import { WorkspaceSettingsModal } from '@/features/workspaces/WorkspaceSettingsModal';
import { cn } from '@/lib/utilities/cn';
import { executionApi } from '@/services/api/executionApi';
import { filesApi } from '@/services/api/filesApi';
import { HAS_REALTIME_WS } from '@/services/api/httpClient';
import { workspacesApi } from '@/services/api/workspacesApi';
import { ApprovalPopups } from './ApprovalPopups';
import { LiveServerPanel } from './LiveServerPanel';
import { VersionHistoryModal } from './VersionHistoryModal';

type BottomTab = 'terminal' | 'output' | 'problems' | 'logs';

function ConnectionPill({
  collabStatus,
  isSynced,
  eventsConnected,
}: {
  collabStatus: CollabConnectionStatus;
  isSynced: boolean;
  eventsConnected: boolean;
}) {
  if (collabStatus === 'serverless') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#22C55E]/30 bg-[#22C55E]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#16A34A]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
        Cloud DB Synced
      </span>
    );
  }
  if (collabStatus === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#EF4444]/35 bg-[#EF4444]/10 px-2.5 py-0.5 text-[11px] font-medium text-red-500">
        <WifiOff className="h-3 w-3" />
        Auth Error
      </span>
    );
  }
  if (collabStatus === 'connected' && isSynced && eventsConnected) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#22C55E]/30 bg-[#22C55E]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#22C55E]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
        Connected
      </span>
    );
  }
  if (collabStatus === 'reconnecting' || collabStatus === 'connecting') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#F59E0B]">
        <Wifi className="h-3 w-3 animate-pulse" />
        {collabStatus === 'reconnecting' ? 'Reconnecting...' : 'Connecting...'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-400/20 bg-slate-800/40 px-2.5 py-0.5 text-[11px] font-medium opacity-75">
      <WifiOff className="h-3 w-3" />
      {collabStatus === 'connected' ? 'Synced' : 'Disconnected'}
    </span>
  );
}

export function WorkspaceIdePage() {
  const { workspaceId = '' } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();
  const { isLight } = useTheme();
  const { notify } = useToast();

  const [workspace, setWorkspace] = useState<WorkspaceDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [openFileIds, setOpenFileIds] = useState<string[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  const [showExplorer, setShowExplorer] = useState(true);
  const [showCollabPanel, setShowCollabPanel] = useState(true);
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [showLiveServer, setShowLiveServer] = useState(false);
  const [bottomTab, setBottomTab] = useState<BottomTab>('terminal');
  const [bottomHeight, setBottomHeight] = useState(240);

  const [shareOpen, setShareOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savingFile, setSavingFile] = useState(false);
  const [liveRefreshTick, setLiveRefreshTick] = useState(0);

  const [editorSettings, setEditorSettings] = useState<EditorSettings>({
    fontSize: 14,
    wordWrap: 'on',
    minimap: true,
    tabSize: 2,
  });

  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([]);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<WorkspaceJoinRequestDto[]>([]);
  const [pendingChangeRequests, setPendingChangeRequests] = useState<FileChangeRequestDto[]>([]);
  const [running, setRunning] = useState(false);
  const [latestOutput, setLatestOutput] = useState<ExecutionResultDto | null>(null);
  const [executionLogs, setExecutionLogs] = useState<ExecutionResultDto[]>([]);
  const [stdinInput, setStdinInput] = useState('');

  const liveContentsRef = useRef<Map<string, string>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchWorkspace = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [{ workspace: ws }, { executions }] = await Promise.all([
        workspacesApi.get(workspaceId),
        executionApi.listHistory(workspaceId).catch(() => ({ executions: [] })),
      ]);
      setWorkspace(ws);
      setExecutionLogs(executions);
      if (ws.liveServerEnabled) {
        setShowLiveServer(true);
      }

      if (ws.currentUserRole === 'OWNER') {
        const [jrRes, crRes] = await Promise.all([
          workspacesApi.listPendingJoinRequests(workspaceId).catch(() => ({ requests: [] })),
          filesApi.listPendingChangeRequests(workspaceId).catch(() => ({ changeRequests: [] })),
        ]);
        setPendingJoinRequests(jrRes.requests);
        setPendingChangeRequests(crRes.changeRequests);
      }

      const firstFile = ws.files.find((f) => f.nodeType === 'FILE') ?? null;
      if (firstFile) {
        setOpenFileIds([firstFile.id]);
        setActiveFileId(firstFile.id);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load workspace');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void fetchWorkspace();
  }, [fetchWorkspace]);

  const handleWorkspaceEvent = useCallback(
    (event: WorkspaceEventPayload) => {
      if (event.type === 'file:created') {
        setWorkspace((prev) => {
          if (!prev) return prev;
          if (prev.files.some((f) => f.id === event.file.id)) return prev;
          return { ...prev, files: [...prev.files, event.file] };
        });
      } else if (event.type === 'file:updated') {
        setWorkspace((prev) =>
          prev
            ? {
                ...prev,
                files: prev.files.map((f) => (f.id === event.file.id ? event.file : f)),
              }
            : prev,
        );
      } else if (event.type === 'file:deleted') {
        const deletedSet = new Set(event.deletedIds);
        setWorkspace((prev) =>
          prev ? { ...prev, files: prev.files.filter((f) => !deletedSet.has(f.id)) } : prev,
        );
        setOpenFileIds((prev) => prev.filter((id) => !deletedSet.has(id)));
        setActiveFileId((prev) => (prev && deletedSet.has(prev) ? null : prev));
      } else if (event.type === 'member:joined') {
        setWorkspace((prev) => {
          if (!prev) return prev;
          if (prev.members.some((m) => m.userId === event.member.userId)) return prev;
          return { ...prev, members: [...prev.members, event.member] };
        });
      } else if (event.type === 'member:updated') {
        setWorkspace((prev) => {
          if (!prev) return prev;
          const nextRole =
            event.member.userId === user?.id ? event.member.role : prev.currentUserRole;
          return {
            ...prev,
            currentUserRole: nextRole,
            members: prev.members.map((m) =>
              m.userId === event.member.userId ? event.member : m,
            ),
          };
        });
      } else if (event.type === 'member:removed') {
        if (event.userId === user?.id) {
          notify({ kind: 'error', title: 'You were removed from this workspace' });
          navigate('/workspaces', { replace: true });
          return;
        }
        setWorkspace((prev) =>
          prev
            ? { ...prev, members: prev.members.filter((m) => m.userId !== event.userId) }
            : prev,
        );
      } else if (event.type === 'workspace:updated') {
        setWorkspace((prev) => (prev ? { ...prev, name: event.name } : prev));
      } else if (event.type === 'workspace:deleted') {
        notify({ kind: 'info', title: 'Workspace was deleted by its owner' });
        navigate('/workspaces', { replace: true });
      } else if (event.type === 'join:requested') {
        setPendingJoinRequests((prev) =>
          prev.some((r) => r.id === event.request.id) ? prev : [...prev, event.request],
        );
      } else if (event.type === 'join:decided') {
        setPendingJoinRequests((prev) => prev.filter((r) => r.id !== event.request.id));
      } else if (event.type === 'change:requested') {
        setPendingChangeRequests((prev) =>
          prev.some((c) => c.id === event.changeRequest.id) ? prev : [...prev, event.changeRequest],
        );
      } else if (event.type === 'change:decided') {
        setPendingChangeRequests((prev) =>
          prev.filter((c) => c.id !== event.changeRequest.id),
        );
        if (event.changeRequest.authorId === user?.id) {
          notify({
            kind: event.changeRequest.status === 'APPROVED' ? 'success' : 'error',
            title:
              event.changeRequest.status === 'APPROVED'
                ? `Changes to "${event.changeRequest.fileName}" approved`
                : `Changes to "${event.changeRequest.fileName}" rejected`,
          });
        }
      } else if (event.type === 'version:created') {
        liveContentsRef.current.set(event.version.fileId, event.version.content);
        setWorkspace((prev) =>
          prev
            ? {
                ...prev,
                files: prev.files.map((f) =>
                  f.id === event.version.fileId
                    ? { ...f, contentSnapshot: event.version.content }
                    : f,
                ),
              }
            : prev,
        );
        setLiveRefreshTick((t) => t + 1);
      } else if (event.type === 'chat:message') {
        setChatMessages((prev) => [...prev.slice(-99), event]);
      }
    },
    [navigate, notify, user?.id],
  );

  const { connected: eventsConnected, sendChatMessage } = useWorkspaceEvents(
    workspaceId,
    accessToken,
    handleWorkspaceEvent,
  );

  const files = useMemo(() => workspace?.files ?? [], [workspace?.files]);
  const activeFile = useMemo(
    () => files.find((f) => f.id === activeFileId && f.nodeType === 'FILE') ?? null,
    [files, activeFileId],
  );
  const openFiles = useMemo(
    () =>
      openFileIds
        .map((id) => files.find((f) => f.id === id))
        .filter((f): f is WorkspaceFileDto => Boolean(f)),
    [openFileIds, files],
  );

  useEffect(() => {
    if (!activeFileId && openFiles.length > 0) {
      setActiveFileId(openFiles[0]!.id);
    }
  }, [activeFileId, openFiles]);

  const {
    yDoc,
    provider,
    status: collabStatus,
    isSynced,
    peers,
  } = useCollabDocument({
    workspaceId,
    fileId: activeFile?.id ?? null,
    fileName: activeFile?.name ?? null,
    initialContent: activeFile?.contentSnapshot ?? '',
    user,
    accessToken,
  });

  // Fallback sync on serverless deployments without a persistent WebSocket host
  const currentRoleForSync = workspace?.currentUserRole;
  useEffect(() => {
    if (HAS_REALTIME_WS || !workspaceId || !currentRoleForSync) return;
    const interval = window.setInterval(async () => {
      try {
        if (currentRoleForSync === 'OWNER') {
          const [jrRes, crRes] = await Promise.all([
            workspacesApi.listPendingJoinRequests(workspaceId),
            filesApi.listPendingChangeRequests(workspaceId),
          ]);
          setPendingJoinRequests(jrRes.requests);
          setPendingChangeRequests(crRes.changeRequests);
        }
        const { workspace: latest } = await workspacesApi.get(workspaceId);
        setWorkspace(latest);
      } catch {
        // ignore transient refresh error
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [workspaceId, currentRoleForSync]);

  const userRole = workspace?.currentUserRole ?? 'VIEWER';
  const isOwner = userRole === 'OWNER';
  const editable = canEditFiles(userRole);
  const executableAllowed = canExecuteCode(userRole);
  const terminalAllowed = canUseTerminal(userRole);
  const canInvite = canManageInvitations(userRole);

  const activeLanguageDef = useMemo(
    () => getLanguageById(activeFile?.language ?? 'plaintext'),
    [activeFile?.language],
  );

  function handleOpenFile(file: WorkspaceFileDto) {
    if (file.nodeType !== 'FILE') return;
    setOpenFileIds((prev) => (prev.includes(file.id) ? prev : [...prev, file.id]));
    setActiveFileId(file.id);
    if (window.innerWidth < 768) {
      setShowExplorer(false);
    }
  }

  function handleCloseTab(fileId: string) {
    setOpenFileIds((prev) => {
      const next = prev.filter((id) => id !== fileId);
      if (activeFileId === fileId) {
        setActiveFileId(next[next.length - 1] ?? null);
      }
      return next;
    });
  }

  async function handleCreateNode(input: {
    parentId: string | null;
    name: string;
    nodeType: 'FILE' | 'FOLDER';
  }) {
    try {
      const { file } = await filesApi.create(workspaceId, input);
      setWorkspace((prev) => {
        if (!prev) return prev;
        if (prev.files.some((f) => f.id === file.id)) return prev;
        return { ...prev, files: [...prev.files, file] };
      });
      if (file.nodeType === 'FILE') {
        handleOpenFile(file);
      }
    } catch (err) {
      notify({
        kind: 'error',
        title: 'Create failed',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleRenameNode(fileId: string, newName: string) {
    try {
      const { file } = await filesApi.update(workspaceId, fileId, { name: newName });
      setWorkspace((prev) =>
        prev
          ? { ...prev, files: prev.files.map((f) => (f.id === file.id ? file : f)) }
          : prev,
      );
    } catch (err) {
      notify({
        kind: 'error',
        title: 'Rename failed',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleDeleteNode(fileId: string) {
    try {
      const { deletedIds } = await filesApi.remove(workspaceId, fileId);
      const deletedSet = new Set(deletedIds);
      setWorkspace((prev) =>
        prev ? { ...prev, files: prev.files.filter((f) => !deletedSet.has(f.id)) } : prev,
      );
      setOpenFileIds((prev) => prev.filter((id) => !deletedSet.has(id)));
      if (activeFileId && deletedSet.has(activeFileId)) {
        setActiveFileId(null);
      }
    } catch (err) {
      notify({
        kind: 'error',
        title: 'Delete failed',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleLanguageChange(languageId: string) {
    if (!activeFile || !editable) return;
    try {
      const { file } = await filesApi.update(workspaceId, activeFile.id, {
        language: languageId,
      });
      setWorkspace((prev) =>
        prev
          ? { ...prev, files: prev.files.map((f) => (f.id === file.id ? file : f)) }
          : prev,
      );
    } catch (err) {
      notify({
        kind: 'error',
        title: 'Failed to change language',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleSaveFile() {
    if (!activeFile || !editable || savingFile) return;
    const content =
      liveContentsRef.current.get(activeFile.id) ??
      yDoc?.getText('monaco').toString() ??
      activeFile.contentSnapshot ??
      '';

    setSavingFile(true);
    try {
      const res = await filesApi.submitSave(workspaceId, activeFile.id, {
        content,
        summary: isOwner ? `Saved ${activeFile.name}` : `Proposed update to ${activeFile.name}`,
      });
      if (res.mode === 'SAVED') {
        notify({
          kind: 'success',
          title: `Saved "${activeFile.name}" (v${res.version.versionNumber})`,
          description: 'Recorded in version history.',
        });
      } else {
        notify({
          kind: 'info',
          title: 'Save request sent to host',
          description: `Waiting for admin approval on "${activeFile.name}".`,
        });
      }
    } catch (err) {
      notify({
        kind: 'error',
        title: 'Save failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSavingFile(false);
    }
  }

  async function handleDecideJoin(
    requestId: string,
    decision: 'APPROVE' | 'REJECT',
    role: 'EDITOR' | 'VIEWER',
  ) {
    try {
      const { request } = await workspacesApi.decideJoinRequest(workspaceId, requestId, {
        decision,
        role,
      });
      setPendingJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
      notify({
        kind: decision === 'APPROVE' ? 'success' : 'info',
        title:
          decision === 'APPROVE'
            ? `Approved ${request.user.displayName} (${role})`
            : `Declined ${request.user.displayName}`,
      });
    } catch (err) {
      notify({
        kind: 'error',
        title: 'Failed to process join decision',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleDecideChange(requestId: string, decision: 'APPROVE' | 'REJECT') {
    try {
      const { changeRequest, version } = await filesApi.decideChangeRequest(
        workspaceId,
        requestId,
        decision,
      );
      setPendingChangeRequests((prev) => prev.filter((c) => c.id !== requestId));
      notify({
        kind: decision === 'APPROVE' ? 'success' : 'info',
        title:
          decision === 'APPROVE'
            ? `Accepted ${changeRequest.authorName}'s changes (v${version?.versionNumber ?? ''})`
            : `Rejected ${changeRequest.authorName}'s changes`,
      });
    } catch (err) {
      notify({
        kind: 'error',
        title: 'Failed to process change request',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleRunCode() {
    if (!activeFile || !executableAllowed || running) return;

    const code =
      liveContentsRef.current.get(activeFile.id) ??
      yDoc?.getText('monaco').toString() ??
      activeFile.contentSnapshot ??
      '';

    setRunning(true);
    setShowBottomPanel(true);
    setBottomTab('output');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await runWorkspaceCode({
        workspaceId,
        fileId: activeFile.id,
        language: activeFile.language,
        code,
        stdin: stdinInput,
        files,
        liveContents: liveContentsRef.current,
        signal: controller.signal,
      });
      setLatestOutput(result);
      setExecutionLogs((prev) => [result, ...prev.slice(0, 24)]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Execution error';
      notify({ kind: 'error', title: 'Execution failed', description: msg });
      setLatestOutput({
        id: `err_${Date.now()}`,
        workspaceId,
        fileId: activeFile.id,
        language: activeFile.language,
        provider: 'error',
        status: 'UNAVAILABLE',
        exitCode: null,
        stdout: '',
        stderr: msg,
        durationMs: 0,
        truncated: false,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      });
    } finally {
      setRunning(false);
      abortControllerRef.current = null;
    }
  }

  function handleStopRun() {
    abortControllerRef.current?.abort();
  }

  function startBottomResize(startY: number) {
    const initialHeight = bottomHeight;
    const onMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      setBottomHeight(Math.max(120, Math.min(520, initialHeight + delta)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  if (loading) {
    return (
      <FullScreenLoader
        message="Opening collaborative workspace..."
        submessage="Connecting CRDT engine and workspace permissions"
      />
    );
  }

  if (loadError || !workspace) {
    return (
      <div
        className={cn(
          'flex h-screen flex-col items-center justify-center gap-4 px-4 text-center',
          isLight ? 'unite-light-canvas text-black' : 'bg-[#080D17] text-[#F8FAFC]',
        )}
      >
        <AlertTriangle className="h-10 w-10 text-[#EF4444]" />
        <h1 className="text-lg font-semibold">Workspace Unavailable</h1>
        <p className="max-w-md text-sm opacity-75">
          {loadError ?? 'You do not have access to this workspace or it no longer exists.'}
        </p>
        <Button variant="primary" size="sm" onClick={() => navigate('/workspaces')}>
          Back to Workspaces
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-screen w-screen flex-col overflow-hidden transition-colors duration-200',
        isLight ? 'bg-white text-black' : 'bg-[#080D17] text-[#F8FAFC]',
      )}
    >
      {/* Top IDE Bar */}
      <header
        className={cn(
          'flex h-12 shrink-0 items-center justify-between border-b px-3',
          isLight
            ? 'unite-light-surface border-black/10'
            : 'border-slate-400/12 bg-[#0E1523]',
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowExplorer((v) => !v)}
            className="rounded-lg p-1.5 opacity-75 hover:bg-black/10 hover:opacity-100 md:hidden"
            aria-label="Toggle explorer"
          >
            <Menu className="h-4 w-4" />
          </button>

          <Link
            to="/workspaces"
            className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-black/5"
            title="All Workspaces"
          >
            <UniteLogo size="sm" />
            <span className="hidden text-sm font-bold tracking-tight sm:inline">Unite</span>
          </Link>

          <span className="opacity-40">/</span>

          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold">{workspace.name}</span>
            <span
              className={cn(
                'hidden rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider sm:inline',
                isLight
                  ? 'border-black/15 bg-black text-white'
                  : 'border-slate-400/15 bg-[#080D17] text-[#22D3EE]',
              )}
            >
              {userRole}
            </span>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(workspace.joinCode);
                notify({ kind: 'success', title: `Copied code ${workspace.joinCode}` });
              }}
              className={cn(
                'hidden items-center gap-1 rounded-lg border px-2 py-0.5 font-mono text-[11px] font-semibold transition-colors lg:inline-flex',
                isLight
                  ? 'border-black/12 bg-white text-black hover:bg-zinc-100'
                  : 'border-slate-400/15 bg-[#080D17] text-[#94A3B8] hover:text-[#F8FAFC]',
              )}
              title="Click to copy 6-digit workspace code"
            >
              <Hash className="h-3 w-3 opacity-60" />
              {workspace.joinCode}
            </button>
          </div>

          <div className="hidden sm:block">
            <ConnectionPill
              collabStatus={collabStatus}
              isSynced={isSynced}
              eventsConnected={eventsConnected}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle compact />

          {/* Online Collaborator Avatars */}
          <div className="hidden items-center -space-x-1.5 pr-1 md:flex">
            {peers.slice(0, 4).map((p) => (
              <UserAvatar
                key={p.clientId}
                userId={p.userId}
                displayName={`${p.name}${p.isSelf ? ' (You)' : ''}`}
                color={p.color}
                size="xs"
                showOnlineDot
              />
            ))}
            {peers.length > 4 && (
              <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-[10px]">
                +{peers.length - 4}
              </span>
            )}
          </div>

          <Button
            variant={showLiveServer ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowLiveServer((v) => !v)}
            title="Toggle Live Server Preview"
          >
            <Globe className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Live Server</span>
          </Button>

          {/* Run / Stop Button */}
          {executableAllowed && (
            <Button
              variant={running ? 'danger' : 'primary'}
              size="sm"
              disabled={!activeFile}
              onClick={running ? handleStopRun : () => void handleRunCode()}
              title={
                activeFile
                  ? `Run ${activeFile.name} (${activeLanguageDef.runtimeLabel})`
                  : 'Select a file to run'
              }
            >
              {running ? (
                <>
                  <Square className="h-3 w-3 fill-current" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Run
                </>
              )}
            </Button>
          )}

          {canInvite && (
            <Button variant="secondary" size="sm" onClick={() => setShareOpen(true)}>
              <Share2 className={cn('h-3.5 w-3.5', isLight ? 'text-black' : 'text-[#22D3EE]')} />
              <span className="hidden sm:inline">Share</span>
            </Button>
          )}

          <button
            type="button"
            onClick={() => setShowCollabPanel((v) => !v)}
            className={cn(
              'rounded-lg p-1.5 transition-colors',
              showCollabPanel
                ? isLight
                  ? 'bg-black text-white'
                  : 'bg-[#141D2D] text-[#22D3EE]'
                : 'opacity-70 hover:bg-black/10 hover:opacity-100',
            )}
            title="Collaborators & Chat"
          >
            <Users className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-lg p-1.5 opacity-70 transition-colors hover:bg-black/10 hover:opacity-100"
            title="Workspace & Editor Settings"
          >
            <Settings className="h-4 w-4" />
          </button>

          {user && (
            <UserAvatar
              userId={user.id}
              displayName={user.displayName}
              size="xs"
              className="hidden sm:inline-flex"
            />
          )}
        </div>
      </header>

      {/* Host/Admin Real-Time Approval Popups */}
      {isOwner && (
        <ApprovalPopups
          joinRequests={pendingJoinRequests}
          changeRequests={pendingChangeRequests}
          onDecideJoin={handleDecideJoin}
          onDecideChange={handleDecideChange}
        />
      )}

      {/* Main IDE Body */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Compact Activity Rail */}
        <aside
          className={cn(
            'hidden w-11 shrink-0 flex-col items-center justify-between border-r py-2.5 md:flex',
            isLight ? 'border-black/10 bg-zinc-50' : 'border-slate-400/12 bg-[#0E1523]',
          )}
        >
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setShowExplorer((v) => !v)}
              className={cn(
                'rounded-lg p-2 transition-colors',
                showExplorer
                  ? isLight
                    ? 'bg-black text-white'
                    : 'bg-[#192438] text-[#22D3EE]'
                  : 'opacity-60 hover:opacity-100',
              )}
              title="Toggle File Explorer"
            >
              <Files className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowCollabPanel((v) => !v)}
              className={cn(
                'rounded-lg p-2 transition-colors',
                showCollabPanel
                  ? isLight
                    ? 'bg-black text-white'
                    : 'bg-[#192438] text-[#22D3EE]'
                  : 'opacity-60 hover:opacity-100',
              )}
              title="Toggle People & Chat"
            >
              <Users className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowBottomPanel((v) => !v)}
              className={cn(
                'rounded-lg p-2 transition-colors',
                showBottomPanel
                  ? isLight
                    ? 'bg-black text-white'
                    : 'bg-[#192438] text-[#22D3EE]'
                  : 'opacity-60 hover:opacity-100',
              )}
              title="Toggle Terminal & Output"
            >
              <Terminal className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowLiveServer((v) => !v)}
              className={cn(
                'rounded-lg p-2 transition-colors',
                showLiveServer
                  ? isLight
                    ? 'bg-black text-white'
                    : 'bg-[#192438] text-[#22D3EE]'
                  : 'opacity-60 hover:opacity-100',
              )}
              title="Toggle Live Server Preview"
            >
              <Globe className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-lg p-2 opacity-60 hover:opacity-100"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </aside>

        {/* Left File Explorer */}
        {showExplorer && (
          <div
            className={cn(
              'absolute inset-y-0 left-0 z-30 w-64 border-r md:static md:z-auto md:shrink-0 md:shadow-none',
              isLight ? 'border-black/10 shadow-xl' : 'border-slate-400/12 shadow-unite-panel',
            )}
          >
            <FileTree
              files={files}
              activeFileId={activeFileId}
              canEdit={editable}
              onOpenFile={handleOpenFile}
              onCreateNode={handleCreateNode}
              onRenameNode={handleRenameNode}
              onDeleteNode={handleDeleteNode}
            />
          </div>
        )}

        {/* Center Editor + Live Server + Bottom Panel */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <EditorTabs
            openFiles={openFiles}
            activeFileId={activeFileId}
            onSelect={setActiveFileId}
            onClose={handleCloseTab}
          />

          {/* Editor Sub-toolbar */}
          {activeFile && (
            <div
              className={cn(
                'flex h-9 shrink-0 items-center justify-between border-b px-3 text-[11px]',
                isLight
                  ? 'border-black/10 bg-white text-zinc-600'
                  : 'border-slate-400/10 bg-[#080D17] text-[#94A3B8]',
              )}
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className={cn(
                    'truncate font-mono font-medium',
                    isLight ? 'text-black' : 'text-[#E2E8F0]',
                  )}
                >
                  {activeFile.name}
                </span>
                {!editable && (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
                    Read-Only Viewer
                  </span>
                )}
                <span className="hidden opacity-70 sm:inline">
                  • {activeLanguageDef.runtimeLabel}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {editable && (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={savingFile}
                    onClick={() => void handleSaveFile()}
                    className="h-6 px-2.5 text-[11px]"
                    title={
                      isOwner
                        ? 'Save snapshot to Version History (Ctrl/Cmd+S)'
                        : 'Send saved changes to Admin for approval (Ctrl/Cmd+S)'
                    }
                  >
                    <Save className="h-3 w-3" />
                    {isOwner ? 'Save' : 'Save & Request Approval'}
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setHistoryOpen(true)}
                  className="h-6 px-2 text-[11px]"
                  title="View file version history"
                >
                  <History className="h-3 w-3" />
                  History
                </Button>

                <select
                  value={activeFile.language}
                  disabled={!editable}
                  onChange={(e) => void handleLanguageChange(e.target.value)}
                  aria-label="Editor language"
                  className={cn(
                    'h-6 rounded border px-1.5 text-[11px] focus:outline-none disabled:opacity-60',
                    isLight
                      ? 'border-black/15 bg-white text-black focus:border-black'
                      : 'border-slate-400/15 bg-[#0E1523] text-[#E2E8F0] focus:border-[#2563EB]',
                  )}
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.id} value={lang.id}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Split Monaco Editor + Optional Live Server */}
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            <div className="relative min-w-0 flex-1">
              {activeFile ? (
                <CollaborativeMonacoEditor
                  fileId={activeFile.id}
                  language={activeLanguageDef.monacoId}
                  yDoc={yDoc}
                  provider={provider}
                  readOnly={!editable}
                  settings={editorSettings}
                  onContentChange={(text) => {
                    liveContentsRef.current.set(activeFile.id, text);
                    if (showLiveServer) {
                      setLiveRefreshTick((t) => t + 1);
                    }
                  }}
                  onRunShortcut={() => void handleRunCode()}
                  onSaveShortcut={() => void handleSaveFile()}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                  <Code2 className="h-10 w-10 opacity-50" />
                  <p className="text-sm font-medium">No file open</p>
                  <p className="max-w-xs text-xs opacity-60">
                    Select a file from the explorer or create a new file to begin collaborative editing.
                  </p>
                </div>
              )}
            </div>

            {showLiveServer && (
              <div className="hidden w-[42%] min-w-[280px] sm:block">
                <LiveServerPanel
                  key={liveRefreshTick > 0 ? 'live' : 'init'}
                  workspaceName={workspace.name}
                  files={files}
                  liveContents={liveContentsRef.current}
                  onClose={() => setShowLiveServer(false)}
                />
              </div>
            )}
          </div>

          {/* Resizable Bottom Panel */}
          {showBottomPanel ? (
            <div
              style={{ height: `${bottomHeight}px` }}
              className={cn(
                'flex shrink-0 flex-col border-t',
                isLight ? 'border-black/10 bg-white' : 'border-slate-400/15 bg-[#080D17]',
              )}
            >
              <div
                onMouseDown={(e) => startBottomResize(e.clientY)}
                className={cn(
                  'h-1 w-full cursor-row-resize bg-transparent transition-colors',
                  isLight ? 'hover:bg-black/40' : 'hover:bg-[#2563EB]/60',
                )}
                title="Drag to resize panel"
              />

              <div
                className={cn(
                  'flex h-8 shrink-0 items-center justify-between border-b px-3',
                  isLight ? 'border-black/10 bg-zinc-50' : 'border-slate-400/10 bg-[#0E1523]',
                )}
              >
                <div className="flex items-center gap-4">
                  {(
                    [
                      { id: 'terminal', label: 'Terminal', icon: Terminal },
                      { id: 'output', label: 'Output', icon: Play },
                      { id: 'problems', label: 'Problems', icon: AlertTriangle },
                      { id: 'logs', label: 'Execution Logs', icon: History },
                    ] as const
                  ).map((item) => {
                    const Icon = item.icon;
                    const active = bottomTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setBottomTab(item.id)}
                        className={cn(
                          'flex h-8 items-center gap-1.5 border-b-2 text-xs font-medium transition-colors',
                          active
                            ? isLight
                              ? 'border-black text-black'
                              : 'border-[#22D3EE] text-[#F8FAFC]'
                            : 'border-transparent opacity-60 hover:opacity-100',
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setShowBottomPanel(false)}
                  className="rounded p-1 opacity-60 hover:opacity-100"
                  title="Collapse panel"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden">
                {bottomTab === 'terminal' && (
                  <TerminalPanel
                    workspaceId={workspaceId}
                    accessToken={accessToken}
                    canUseTerminal={terminalAllowed}
                    files={files}
                    liveContents={liveContentsRef.current}
                  />
                )}

                {bottomTab === 'output' && (
                  <div className="flex h-full flex-col overflow-y-auto p-3 font-mono text-xs">
                    {activeLanguageDef.runtime === 'hosted-sandbox' && (
                      <div className="mb-2.5 flex items-center gap-2 border-b border-[var(--unite-border)] pb-2 font-sans">
                        <span className="text-[11px] opacity-75">Program stdin:</span>
                        <input
                          type="text"
                          value={stdinInput}
                          onChange={(e) => setStdinInput(e.target.value)}
                          placeholder="Optional standard input..."
                          className={cn(
                            'h-6 flex-1 rounded border px-2 text-xs focus:outline-none',
                            isLight
                              ? 'border-black/15 bg-white text-black'
                              : 'border-slate-400/15 bg-[#0E1523] text-[#F8FAFC]',
                          )}
                        />
                      </div>
                    )}

                    {running && <p className="opacity-80">Running {activeFile?.name}...</p>}

                    {!running && !latestOutput && (
                      <p className="opacity-60">
                        Click Run (or press Ctrl/Cmd + Enter) to execute the active file.
                      </p>
                    )}

                    {latestOutput && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 font-sans text-[11px]">
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 font-semibold',
                              latestOutput.status === 'COMPLETED'
                                ? 'bg-[#22C55E]/15 text-[#16A34A]'
                                : latestOutput.status === 'UNAVAILABLE'
                                  ? 'bg-[#F59E0B]/15 text-[#D97706]'
                                  : 'bg-[#EF4444]/15 text-red-500',
                            )}
                          >
                            {latestOutput.status}
                          </span>
                          <span className="opacity-75">Provider: {latestOutput.provider}</span>
                          {latestOutput.exitCode !== null && (
                            <span className="opacity-75">Exit: {latestOutput.exitCode}</span>
                          )}
                          <span className="opacity-60">{latestOutput.durationMs}ms</span>
                        </div>

                        {latestOutput.stdout && (
                          <pre className="whitespace-pre-wrap break-words">
                            {latestOutput.stdout}
                          </pre>
                        )}
                        {latestOutput.stderr && (
                          <pre className="whitespace-pre-wrap break-words text-red-500">
                            {latestOutput.stderr}
                          </pre>
                        )}
                        {!latestOutput.stdout && !latestOutput.stderr && (
                          <p className="opacity-60">(No output produced)</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {bottomTab === 'problems' && (
                  <div className="h-full overflow-y-auto p-3 text-xs">
                    {latestOutput && latestOutput.stderr ? (
                      <div className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 p-3 font-mono text-red-500">
                        <div className="mb-1 font-sans text-[11px] font-semibold uppercase tracking-wider">
                          {latestOutput.status} ({latestOutput.language})
                        </div>
                        <pre className="whitespace-pre-wrap break-words">
                          {latestOutput.stderr}
                        </pre>
                      </div>
                    ) : (
                      <p className="opacity-60">No compilation or runtime problems detected.</p>
                    )}
                  </div>
                )}

                {bottomTab === 'logs' && (
                  <div className="h-full space-y-1.5 overflow-y-auto p-3 text-xs">
                    {executionLogs.length === 0 ? (
                      <p className="opacity-60">No recorded executions in this workspace yet.</p>
                    ) : (
                      executionLogs.map((rec) => (
                        <div
                          key={rec.id}
                          className={cn(
                            'flex items-center justify-between rounded-lg border px-3 py-2',
                            isLight
                              ? 'border-black/10 bg-zinc-50'
                              : 'border-slate-400/10 bg-[#0E1523]',
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                                rec.status === 'COMPLETED'
                                  ? 'bg-[#22C55E]/15 text-[#16A34A]'
                                  : 'bg-[#EF4444]/15 text-red-500',
                              )}
                            >
                              {rec.status}
                            </span>
                            <span className="font-mono font-medium">{rec.language}</span>
                            <span className="opacity-60">via {rec.provider}</span>
                          </div>
                          <div className="text-[11px] opacity-70">
                            {rec.durationMs}ms • {new Date(rec.startedAt).toLocaleTimeString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              className={cn(
                'flex h-7 shrink-0 items-center justify-between border-t px-3 text-xs',
                isLight
                  ? 'border-black/10 bg-zinc-50 text-zinc-600'
                  : 'border-slate-400/12 bg-[#0E1523] text-[#94A3B8]',
              )}
            >
              <span>Terminal & Output minimized</span>
              <button
                type="button"
                onClick={() => setShowBottomPanel(true)}
                className="inline-flex items-center gap-1 font-medium underline"
              >
                <ChevronUp className="h-3.5 w-3.5" />
                Open Panel
              </button>
            </div>
          )}
        </div>

        {/* Right Collaboration & Chat Panel */}
        {showCollabPanel && (
          <div className="absolute inset-y-0 right-0 z-30 w-64 shadow-xl lg:static lg:z-auto lg:shrink-0 lg:shadow-none">
            <CollaboratorsSidebar
              currentUserId={user?.id ?? ''}
              currentUserRole={userRole}
              members={workspace.members}
              peers={peers}
              chatMessages={chatMessages}
              eventsConnected={eventsConnected}
              onSendChat={sendChatMessage}
              onUpdateRole={async (targetId, role) => {
                await workspacesApi.updateMemberRole(workspaceId, targetId, role);
                notify({ kind: 'success', title: 'Member role updated' });
              }}
              onRemoveMember={async (targetId) => {
                await workspacesApi.removeMember(workspaceId, targetId);
                notify({ kind: 'info', title: 'Member removed' });
              }}
              onLeaveWorkspace={async () => {
                await workspacesApi.leave(workspaceId);
                notify({ kind: 'info', title: 'Left workspace' });
                navigate('/workspaces', { replace: true });
              }}
            />
          </div>
        )}
      </div>

      <ShareWorkspaceModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        workspaceId={workspaceId}
        workspaceName={workspace.name}
        joinCode={workspace.joinCode}
      />

      <VersionHistoryModal
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        workspaceId={workspaceId}
        fileId={activeFile?.id ?? null}
        fileName={activeFile?.name ?? null}
        isOwner={isOwner}
      />

      <WorkspaceSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        workspaceId={workspaceId}
        workspaceName={workspace.name}
        isOwner={isOwner}
        editorSettings={editorSettings}
        onEditorSettingsChange={setEditorSettings}
        onWorkspaceRenamed={(name) =>
          setWorkspace((prev) => (prev ? { ...prev, name } : prev))
        }
      />
    </div>
  );
}
