import '@xterm/xterm/css/xterm.css';
import type { WebContainerProcess } from '@webcontainer/api';
import type { WorkspaceFileDto } from '@shared/types/models';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import { Plus, RotateCcw, TerminalSquare, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isWebContainerSupported,
  spawnWebContainerShell,
  syncWorkspaceToWebContainer,
} from '@/features/execution/webContainerRuntime';
import { useTheme } from '@/features/theme/ThemeContext';
import { cn } from '@/lib/utilities/cn';
import { TERMINAL_WS_URL } from '@/services/api/httpClient';

interface TerminalTab {
  id: string;
  label: string;
}

interface TerminalPanelProps {
  workspaceId: string;
  accessToken: string | null;
  canUseTerminal: boolean;
  files: WorkspaceFileDto[];
  liveContents: Map<string, string>;
}

interface ActiveSession {
  term: Terminal;
  fit: FitAddon;
  process: WebContainerProcess | null;
  ws: WebSocket | null;
  resizeObserver: ResizeObserver;
}

const DARK_XTERM_THEME = {
  background: '#080D17',
  foreground: '#F8FAFC',
  cursor: '#22D3EE',
  selectionBackground: 'rgba(37, 99, 235, 0.35)',
  black: '#0F172A',
  red: '#EF4444',
  green: '#22C55E',
  yellow: '#F59E0B',
  blue: '#3B82F6',
  magenta: '#A855F7',
  cyan: '#22D3EE',
  white: '#F8FAFC',
};

const LIGHT_XTERM_THEME = {
  background: '#FFFFFF',
  foreground: '#09090B',
  cursor: '#000000',
  selectionBackground: 'rgba(0, 0, 0, 0.14)',
  black: '#09090B',
  red: '#DC2626',
  green: '#16A34A',
  yellow: '#D97706',
  blue: '#1D4ED8',
  magenta: '#7E22CE',
  cyan: '#0F766E',
  white: '#52525B',
};

export function TerminalPanel({
  workspaceId,
  accessToken,
  canUseTerminal,
  files,
  liveContents,
}: TerminalPanelProps) {
  const { isLight } = useTheme();
  const [tabs, setTabs] = useState<TerminalTab[]>([{ id: 'term-1', label: 'bash 1' }]);
  const [activeTabId, setActiveTabId] = useState('term-1');
  const [sessionState, setSessionState] = useState<'booting' | 'ready' | 'unavailable' | 'readonly'>(
    canUseTerminal ? 'booting' : 'readonly',
  );

  const containerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const sessionsRef = useRef<Map<string, ActiveSession>>(new Map());
  const tabCounterRef = useRef(1);

  const filesRef = useRef(files);
  filesRef.current = files;
  const liveContentsRef = useRef(liveContents);
  liveContentsRef.current = liveContents;

  useEffect(() => {
    for (const s of sessionsRef.current.values()) {
      s.term.options.theme = isLight ? LIGHT_XTERM_THEME : DARK_XTERM_THEME;
    }
  }, [isLight]);

  const startSessionForTab = useCallback(
    async (tabId: string) => {
      const container = containerRefs.current.get(tabId);
      if (!container || sessionsRef.current.has(tabId)) return;

      const term = new Terminal({
        cursorBlink: true,
        fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
        fontSize: 12.5,
        lineHeight: 1.35,
        theme: isLight ? LIGHT_XTERM_THEME : DARK_XTERM_THEME,
      });

      const fit = new FitAddon();
      term.loadAddon(fit);
      term.loadAddon(new WebLinksAddon());
      term.open(container);
      fit.fit();

      const session: ActiveSession = {
        term,
        fit,
        process: null,
        ws: null,
        resizeObserver: new ResizeObserver(() => {
          try {
            fit.fit();
            session.process?.resize({ cols: term.cols, rows: term.rows });
          } catch {
            // Ignore resize during unmount
          }
        }),
      };
      session.resizeObserver.observe(container);
      sessionsRef.current.set(tabId, session);

      if (!canUseTerminal) {
        setSessionState('readonly');
        term.writeln('\x1b[33m[Unite] Viewer role is read-only. Terminal execution is disabled.\x1b[0m');
        return;
      }

      if (accessToken) {
        try {
          const ws = new WebSocket(
            `${TERMINAL_WS_URL}?workspaceId=${encodeURIComponent(workspaceId)}&token=${encodeURIComponent(accessToken)}`,
          );
          session.ws = ws;
          ws.onmessage = (ev) => {
            try {
              const payload = JSON.parse(String(ev.data)) as {
                type?: string;
                mode?: string;
                message?: string;
              };
              if (payload.mode === 'remote-sandbox' && payload.message) {
                term.writeln(`\x1b[36m[Gateway] ${payload.message}\x1b[0m`);
              }
            } catch {
              term.write(String(ev.data));
            }
          };
        } catch {
          // Gateway status check is non-fatal when browser sandbox is active
        }
      }

      if (!isWebContainerSupported()) {
        setSessionState('unavailable');
        term.writeln(
          '\x1b[33m[Unite Terminal] Browser WebContainer shell requires Cross-Origin Isolation (COOP/COEP).\x1b[0m',
        );
        term.writeln(
          '\x1b[90mUse the Run button for Pyodide (Python) or Hosted Sandbox (C/C++/Java) execution.\x1b[0m',
        );
        return;
      }

      setSessionState('booting');
      term.writeln('[Unite] Booting isolated browser WebContainer shell...');

      try {
        await syncWorkspaceToWebContainer(filesRef.current, liveContentsRef.current);
        const shellProcess = await spawnWebContainerShell(term.cols, term.rows);
        session.process = shellProcess;
        setSessionState('ready');

        const inputWriter = shellProcess.input.getWriter();
        term.onData((data) => {
          void inputWriter.write(data);
        });

        void shellProcess.output.pipeTo(
          new WritableStream({
            write(chunk) {
              term.write(chunk);
            },
          }),
        );

        void shellProcess.exit.then((code) => {
          term.writeln(`\r\n[Shell exited with code ${code}]`);
        });
      } catch (err) {
        setSessionState('unavailable');
        term.writeln(
          `\x1b[31m[Terminal Error] ${err instanceof Error ? err.message : 'Unable to boot shell'}\x1b[0m`,
        );
      }
    },
    [accessToken, canUseTerminal, isLight, workspaceId],
  );

  useEffect(() => {
    void startSessionForTab(activeTabId);
  }, [activeTabId, startSessionForTab]);

  useEffect(() => {
    const sessions = sessionsRef.current;
    return () => {
      for (const s of sessions.values()) {
        s.resizeObserver.disconnect();
        s.process?.kill();
        s.ws?.close();
        s.term.dispose();
      }
      sessions.clear();
    };
  }, []);

  function handleAddTab() {
    tabCounterRef.current += 1;
    const id = `term-${tabCounterRef.current}`;
    setTabs((prev) => [...prev, { id, label: `bash ${tabCounterRef.current}` }]);
    setActiveTabId(id);
  }

  function handleCloseTab(id: string) {
    const session = sessionsRef.current.get(id);
    if (session) {
      session.resizeObserver.disconnect();
      session.process?.kill();
      session.ws?.close();
      session.term.dispose();
      sessionsRef.current.delete(id);
    }

    setTabs((prev) => {
      const remaining = prev.filter((t) => t.id !== id);
      if (remaining.length === 0) {
        tabCounterRef.current += 1;
        const freshId = `term-${tabCounterRef.current}`;
        setActiveTabId(freshId);
        return [{ id: freshId, label: `bash ${tabCounterRef.current}` }];
      }
      if (activeTabId === id) {
        setActiveTabId(remaining[remaining.length - 1]!.id);
      }
      return remaining;
    });
  }

  function handleClear() {
    sessionsRef.current.get(activeTabId)?.term.clear();
  }

  async function handleSyncFiles() {
    if (!isWebContainerSupported()) return;
    await syncWorkspaceToWebContainer(filesRef.current, liveContentsRef.current);
    sessionsRef.current
      .get(activeTabId)
      ?.term.writeln('\r\n[Unite] Synced latest workspace files into shell.');
  }

  return (
    <div className={cn('flex h-full flex-col', isLight ? 'bg-white' : 'bg-[#080D17]')}>
      <div
        className={cn(
          'flex h-8 items-center justify-between border-b px-2',
          isLight ? 'border-black/10 bg-zinc-50' : 'border-slate-400/10 bg-[#0E1523]',
        )}
      >
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                tab.id === activeTabId
                  ? isLight
                    ? 'bg-black text-white'
                    : 'bg-[#141D2D] text-[#F8FAFC]'
                  : isLight
                    ? 'text-zinc-500 hover:text-black'
                    : 'text-[#64748B] hover:text-[#94A3B8]',
              )}
            >
              <TerminalSquare
                className={cn(
                  'h-3 w-3',
                  tab.id === activeTabId && isLight ? 'text-white' : isLight ? 'text-black' : 'text-[#22D3EE]',
                )}
              />
              <span>{tab.label}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseTab(tab.id);
                }}
                className="rounded p-0.5 hover:bg-black/15"
                aria-label={`Close ${tab.label}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddTab}
            className="rounded p-1 opacity-70 hover:bg-black/10 hover:opacity-100"
            title="New terminal"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-medium',
              sessionState === 'ready'
                ? 'bg-[#22C55E]/15 text-[#16A34A]'
                : sessionState === 'booting'
                  ? 'bg-[#F59E0B]/15 text-[#D97706]'
                  : isLight
                    ? 'bg-zinc-200 text-zinc-700'
                    : 'bg-slate-700/40 text-[#94A3B8]',
            )}
          >
            {sessionState === 'ready'
              ? 'WebContainer Ready'
              : sessionState === 'booting'
                ? 'Booting...'
                : sessionState === 'readonly'
                  ? 'Read-Only'
                  : 'Limited'}
          </span>
          {canUseTerminal && isWebContainerSupported() && (
            <button
              type="button"
              onClick={() => void handleSyncFiles()}
              className="rounded p-1 opacity-70 hover:bg-black/10 hover:opacity-100"
              title="Sync workspace files to shell"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleClear}
            className="rounded p-1 opacity-70 hover:bg-black/10 hover:opacity-100"
            title="Clear terminal"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            ref={(el) => {
              if (el) containerRefs.current.set(tab.id, el);
              else containerRefs.current.delete(tab.id);
            }}
            className={cn(
              'absolute inset-0 h-full w-full',
              tab.id === activeTabId ? 'block' : 'hidden',
            )}
          />
        ))}
      </div>
    </div>
  );
}
