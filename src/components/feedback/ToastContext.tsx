import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTheme } from '@/features/theme/ThemeContext';
import { cn } from '@/lib/utilities/cn';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface ToastContextValue {
  notify: (toast: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { isLight } = useTheme();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 backdrop-blur-md',
              isLight
                ? 'bg-white/95 text-black shadow-[0_12px_32px_rgba(0,0,0,0.12)]'
                : 'bg-[#0E1523]/95 text-[#F8FAFC] shadow-unite-panel',
              t.kind === 'error'
                ? 'border-[#EF4444]/40'
                : t.kind === 'success'
                  ? 'border-[#22C55E]/40'
                  : isLight
                    ? 'border-black/15'
                    : 'border-slate-400/20',
            )}
          >
            {t.kind === 'success' && (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#22C55E]" />
            )}
            {t.kind === 'error' && (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#EF4444]" />
            )}
            {t.kind === 'info' && (
              <Info
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0',
                  isLight ? 'text-black' : 'text-[#22D3EE]',
                )}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">{t.title}</p>
              {t.description && (
                <p
                  className={cn(
                    'mt-0.5 text-xs',
                    isLight ? 'text-zinc-600' : 'text-[#94A3B8]',
                  )}
                >
                  {t.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className={cn(
                'rounded p-0.5',
                isLight ? 'text-zinc-400 hover:text-black' : 'text-[#64748B] hover:text-[#F8FAFC]',
              )}
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
