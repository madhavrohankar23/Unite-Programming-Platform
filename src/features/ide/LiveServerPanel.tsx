import type { WorkspaceFileDto } from '@shared/types/models';
import { Globe, RefreshCw, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTheme } from '@/features/theme/ThemeContext';
import { cn } from '@/lib/utilities/cn';

interface LiveServerPanelProps {
  workspaceName: string;
  files: WorkspaceFileDto[];
  liveContents: Map<string, string>;
  onClose: () => void;
}

function getFileText(file: WorkspaceFileDto, liveContents: Map<string, string>): string {
  return liveContents.get(file.id) ?? file.contentSnapshot ?? '';
}

function buildLiveHtmlDocument(
  files: WorkspaceFileDto[],
  liveContents: Map<string, string>,
): string {
  const htmlFile =
    files.find((f) => f.nodeType === 'FILE' && f.name.toLowerCase() === 'index.html') ??
    files.find((f) => f.nodeType === 'FILE' && f.name.toLowerCase().endsWith('.html'));

  const cssFiles = files.filter(
    (f) => f.nodeType === 'FILE' && f.name.toLowerCase().endsWith('.css'),
  );
  const jsFiles = files.filter(
    (f) =>
      f.nodeType === 'FILE' &&
      (f.name.toLowerCase().endsWith('.js') || f.name.toLowerCase().endsWith('.jsx')),
  );

  const combinedCss = cssFiles.map((f) => getFileText(f, liveContents)).join('\n');
  const hasJsx = jsFiles.some((f) => f.name.toLowerCase().endsWith('.jsx'));

  let html = htmlFile
    ? getFileText(htmlFile, liveContents)
    : '<!doctype html><html><body><h1>Unite Live Server</h1><p>Create an index.html file to preview.</p></body></html>';

  // Inline local <link rel="stylesheet" href="..."> references
  html = html.replace(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi, (tag, href: string) => {
    const clean = href.replace(/^\.?\//, '').split('/').pop()?.toLowerCase();
    const match = cssFiles.find((f) => f.name.toLowerCase() === clean);
    if (match) {
      return `<style>\n${getFileText(match, liveContents)}\n</style>`;
    }
    return tag;
  });

  // Inline local <script ... src="..."> references
  html = html.replace(
    /<script([^>]*)src=["']([^"']+)["']([^>]*)><\/script>/gi,
    (tag, before: string, src: string, after: string) => {
      if (/^https?:\/\//i.test(src)) return tag;
      const clean = src.replace(/^\.?\//, '').split('/').pop()?.toLowerCase();
      const match = jsFiles.find((f) => f.name.toLowerCase() === clean);
      if (match) {
        return `<script${before}${after}>\n${getFileText(match, liveContents)}\n</script>`;
      }
      return tag;
    },
  );

  if (hasJsx) {
    const reactRuntime = `
      <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
      <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
      <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    `;
    html = html.includes('</head>')
      ? html.replace('</head>', `${reactRuntime}</head>`)
      : `${reactRuntime}${html}`;
  }

  if (!htmlFile && combinedCss) {
    html = `<style>${combinedCss}</style>${html}`;
  }

  return html;
}

export function LiveServerPanel({
  workspaceName,
  files,
  liveContents,
  onClose,
}: LiveServerPanelProps) {
  const { isLight } = useTheme();
  const [reloadTick, setReloadTick] = useState(0);

  const srcDoc = useMemo(
    () => buildLiveHtmlDocument(files, liveContents),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files, liveContents, reloadTick],
  );

  return (
    <div
      className={cn(
        'flex h-full flex-col border-l',
        isLight
          ? 'border-black/10 bg-white text-black'
          : 'border-slate-400/12 bg-[#0E1523] text-[#F8FAFC]',
      )}
    >
      <div
        className={cn(
          'flex h-9 shrink-0 items-center justify-between border-b px-3',
          isLight ? 'border-black/10 bg-zinc-50' : 'border-slate-400/12 bg-[#0E1523]',
        )}
      >
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#22C55E]" />
          <Globe className="h-3.5 w-3.5 shrink-0 opacity-75" />
          <span className="truncate font-mono text-[11px] opacity-80">
            live://{workspaceName.toLowerCase().replace(/\s+/g, '-')}/index.html
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setReloadTick((n) => n + 1)}
            className="rounded p-1 opacity-70 hover:bg-black/10 hover:opacity-100"
            title="Reload Live Server"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 opacity-70 hover:bg-black/10 hover:opacity-100"
            title="Close Live Server"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <iframe
        key={reloadTick}
        title="Unite Live Server Preview"
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-forms allow-modals"
        className="h-full w-full flex-1 bg-white"
      />
    </div>
  );
}

