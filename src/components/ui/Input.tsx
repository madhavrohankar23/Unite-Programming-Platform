import type { InputHTMLAttributes } from 'react';
import { useTheme } from '@/features/theme/ThemeContext';
import { cn } from '@/lib/utilities/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  const { isLight } = useTheme();
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className={cn(
            'block text-xs font-medium',
            isLight ? 'text-zinc-700' : 'text-[#94A3B8]',
          )}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'h-10 w-full rounded-xl border px-3.5 text-sm transition-colors focus:outline-none focus:ring-2',
          isLight
            ? 'border-black/15 bg-white text-black placeholder:text-zinc-400 focus:border-black focus:ring-black/15'
            : 'border-slate-400/15 bg-[#080D17]/80 text-[#F8FAFC] placeholder:text-[#64748B] focus:border-[#2563EB] focus:ring-[#2563EB]/25',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-[#EF4444]/60 focus:border-[#EF4444] focus:ring-[#EF4444]/25',
          className,
        )}
        {...props}
      />
      {error && (
        <p className={cn('text-xs', isLight ? 'text-red-600' : 'text-[#FCA5A5]')}>{error}</p>
      )}
    </div>
  );
}
