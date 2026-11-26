import { FileCode2, X } from 'lucide-react';
import type { WorkspaceFileDto } from '@shared/types/models';
import { useTheme } from '@/features/theme/ThemeContext';
import { cn } from '@/lib/utilities/cn';

interface EditorTabsProps {
  openFiles: WorkspaceFileDto[];
  activeFileId: string | null;
  onSelect: (fileId: string) => void;
  onClose: (fileId: string) => void;
}

export function EditorTabs({ openFiles, activeFileId, onSelect, onClose }: EditorTabsProps) {
  const { isLight } = useTheme();
  if (openFiles.length === 0) return null;

  return (
    <div
      className={cn(
        'flex h-9 items-center overflow-x-auto border-b',
        isLight
          ? 'border-black/10 bg-zinc-50'
          : 'border-slate-400/12 bg-[#0E1523]',
      )}
    >
      {openFiles.map((file) => {
        const isActive = file.id === activeFileId;
        return (
          <div
            key={file.id}
            onClick={() => onSelect(file.id)}
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelect(file.id);
            }}
            className={cn(
              'group flex h-full shrink-0 cursor-pointer items-center gap-2 border-r px-3 text-xs transition-colors',
              isLight ? 'border-black/10' : 'border-slate-400/10',
              isActive
                ? isLight
                  ? 'border-t-2 border-t-black bg-white font-semibold text-black'
                  : 'border-t-2 border-t-[#22D3EE] bg-[#080D17] text-[#F8FAFC]'
                : isLight
                  ? 'text-zinc-500 hover:bg-zinc-100 hover:text-black'
                  : 'text-[#94A3B8] hover:bg-[#141D2D]/60 hover:text-[#F8FAFC]',
            )}
          >
            <FileCode2
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                isActive
                  ? isLight
                    ? 'text-black'
                    : 'text-[#22D3EE]'
                  : isLight
                    ? 'text-zinc-400'
                    : 'text-[#64748B]',
              )}
            />
            <span className="max-w-[140px] truncate font-medium">{file.name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose(file.id);
              }}
              className={cn(
                'rounded p-0.5 opacity-60 transition-opacity group-hover:opacity-100',
                isLight
                  ? 'text-zinc-400 hover:bg-black/10 hover:text-black'
                  : 'text-[#64748B] hover:bg-slate-700/60 hover:text-[#F8FAFC]',
              )}
              aria-label={`Close ${file.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
