import type { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { useTheme } from '@/features/theme/ThemeContext';
import { cn } from '@/lib/utilities/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const { isLight } = useTheme();

  const variantStyles = isLight
    ? {
        primary:
          'bg-gradient-to-b from-zinc-800 via-zinc-950 to-black text-white hover:from-zinc-700 hover:to-black shadow-[0_8px_22px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.18)] border border-black/80',
        secondary:
          'bg-gradient-to-b from-white to-zinc-100 text-black hover:from-zinc-50 hover:to-zinc-200/70 border border-black/12 shadow-[0_2px_8px_rgba(0,0,0,0.05)]',
        outline:
          'bg-transparent text-black hover:bg-black/5 border border-black/20',
        ghost:
          'bg-transparent text-zinc-600 hover:text-black hover:bg-black/5 border border-transparent',
        danger:
          'bg-red-500/10 text-red-700 hover:bg-red-500/20 border border-red-500/25',
      }[variant]
    : {
        primary:
          'bg-[#2563EB] text-white hover:bg-[#3B82F6] shadow-[0_0_24px_rgba(37,99,235,0.32)] border border-blue-400/20',
        secondary:
          'bg-[#141D2D] text-[#F8FAFC] hover:bg-[#192438] border border-slate-400/15',
        outline:
          'bg-transparent text-[#F8FAFC] hover:bg-slate-800/60 border border-slate-400/20',
        ghost:
          'bg-transparent text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-slate-800/50 border border-transparent',
        danger:
          'bg-[#EF4444]/15 text-[#FCA5A5] hover:bg-[#EF4444]/25 border border-[#EF4444]/30',
      }[variant];

  const sizeStyles = {
    sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
    md: 'h-10 px-4 text-sm rounded-xl gap-2',
    lg: 'h-11 px-6 text-sm rounded-xl gap-2',
  }[size];

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--unite-accent)]/60',
        'disabled:pointer-events-none disabled:opacity-50',
        variantStyles,
        sizeStyles,
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
