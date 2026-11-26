import { useTheme } from '@/features/theme/ThemeContext';
import { cn } from '@/lib/utilities/cn';

interface UniteLogoProps {
  size?: 'sm' | 'md' | 'lg';
  withBadge?: boolean;
  className?: string;
}

export function UniteLogo({ size = 'md', withBadge = true, className }: UniteLogoProps) {
  const { isLight } = useTheme();
  const dimensions =
    size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-16 w-16' : 'h-9 w-9';
  const iconSize = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-9 w-9' : 'h-5 w-5';
  const gradId = isLight ? 'uniteMarkGradLight' : 'uniteMarkGradDark';

  const svg = (
    <svg viewBox="0 0 64 64" fill="none" className={iconSize} aria-hidden="true">
      <defs>
        <linearGradient
          id={gradId}
          x1="14"
          y1="10"
          x2="50"
          y2="54"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={isLight ? '#FFFFFF' : '#22D3EE'} />
          <stop offset="100%" stopColor={isLight ? '#D4D4D8' : '#14B8A6'} />
        </linearGradient>
      </defs>
      <path
        d="M16 14L27 24V37L32 41.5L37 37V24L48 14V37.5C48 40.7 46.2 43.7 43.3 45.3L32 51.5L20.7 45.3C17.8 43.7 16 40.7 16 37.5V14Z"
        stroke={`url(#${gradId})`}
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      <path
        d="M22 20.5V35.5L32 44.5L42 35.5V20.5"
        stroke={`url(#${gradId})`}
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M26.5 30.5L32 25.5L37.5 30.5L32 35.5L26.5 30.5Z"
        stroke={`url(#${gradId})`}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (!withBadge) {
    return <span className={cn('inline-flex items-center justify-center', className)}>{svg}</span>;
  }

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center rounded-2xl border transition-all duration-200',
        isLight
          ? 'border-black/20 bg-gradient-to-b from-zinc-800 via-zinc-950 to-black shadow-[0_12px_30px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.2)]'
          : 'border-slate-400/15 bg-[#0E1523]/90 shadow-unite-cyan-glow',
        dimensions,
        className,
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute -inset-1 rounded-2xl blur-md',
          isLight
            ? 'bg-gradient-to-b from-black/15 to-transparent'
            : 'bg-gradient-to-b from-cyan-400/15 to-blue-600/10',
        )}
        aria-hidden="true"
      />
      <span className="relative z-10 flex items-center justify-center">{svg}</span>
    </div>
  );
}
