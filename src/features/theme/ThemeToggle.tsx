import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utilities/cn';
import { useTheme } from './ThemeContext';

interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
}

export function ThemeToggle({ compact = false, className }: ThemeToggleProps) {
  const { isLight, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      role="switch"
      aria-checked={isLight}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to daylight mode'}
      title={isLight ? 'Switch to Dark Mode' : 'Switch to Daylight Mode'}
      className={cn(
        'group inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-all duration-200',
        isLight
          ? 'border-black/15 bg-gradient-to-b from-white to-zinc-100 text-black shadow-[0_2px_10px_rgba(0,0,0,0.06)] hover:border-black/30'
          : 'border-slate-400/15 bg-[#0E1523]/85 text-[#94A3B8] hover:border-slate-400/30 hover:text-[#F8FAFC]',
        className,
      )}
    >
      <span
        className={cn(
          'relative inline-flex h-4 w-7 items-center rounded-full p-0.5 transition-colors duration-200',
          isLight ? 'bg-black' : 'bg-slate-700',
        )}
      >
        <span
          className={cn(
            'flex h-3 w-3 items-center justify-center rounded-full transition-transform duration-200',
            isLight ? 'translate-x-3 bg-white text-black' : 'translate-x-0 bg-[#22D3EE] text-[#080D17]',
          )}
        >
          {isLight ? <Sun className="h-2 w-2" /> : <Moon className="h-2 w-2" />}
        </span>
      </span>
      {!compact && <span>{isLight ? 'Daylight' : 'Dark'}</span>}
    </button>
  );
}

