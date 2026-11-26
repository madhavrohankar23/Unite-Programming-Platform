import { motion } from 'framer-motion';
import { useTheme } from '@/features/theme/ThemeContext';
import { cn } from '@/lib/utilities/cn';

interface UniteTransitionLoaderProps {
  message?: string;
  submessage?: string;
}

export function UniteTransitionLoader({
  message = 'Initializing Unite Workspace...',
  submessage = 'Synchronizing collaborative state',
}: UniteTransitionLoaderProps) {
  const { isLight } = useTheme();

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden transition-colors',
        isLight
          ? 'bg-[radial-gradient(circle_at_50%_40%,#FFFFFF_0%,#F4F4F5_55%,#E4E4E7_100%)] text-black'
          : 'bg-[#080D17] text-[#F8FAFC]',
      )}
    >
      {/* Ambient radial glow */}
      <motion.div
        aria-hidden="true"
        animate={{ scale: [0.92, 1.08, 0.92], opacity: [0.45, 0.75, 0.45] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        className={cn(
          'pointer-events-none absolute h-80 w-80 rounded-full blur-3xl',
          isLight
            ? 'bg-[radial-gradient(circle,rgba(0,0,0,0.09)_0%,transparent_70%)]'
            : 'bg-[radial-gradient(circle,rgba(34,211,238,0.16)_0%,rgba(37,99,235,0.1)_50%,transparent_72%)]',
        )}
      />

      {/* Animated geometric Unite Logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className={cn(
          'relative flex h-24 w-24 items-center justify-center rounded-3xl border shadow-2xl',
          isLight
            ? 'border-black/15 bg-gradient-to-b from-white via-zinc-50 to-zinc-200/80 shadow-[0_20px_50px_rgba(0,0,0,0.12)]'
            : 'border-slate-400/20 bg-[#0E1523]/95 shadow-unite-cyan-glow',
        )}
      >
        <svg viewBox="0 0 64 64" fill="none" className="h-14 w-14">
          <defs>
            <linearGradient
              id="uniteLoaderGrad"
              x1="14"
              y1="10"
              x2="50"
              y2="54"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={isLight ? '#000000' : '#22D3EE'} />
              <stop offset="100%" stopColor={isLight ? '#52525B' : '#14B8A6'} />
            </linearGradient>
          </defs>
          <motion.path
            d="M16 14L27 24V37L32 41.5L37 37V24L48 14V37.5C48 40.7 46.2 43.7 43.3 45.3L32 51.5L20.7 45.3C17.8 43.7 16 40.7 16 37.5V14Z"
            stroke="url(#uniteLoaderGrad)"
            strokeWidth="2.8"
            strokeLinejoin="round"
            initial={{ pathLength: 0.15, opacity: 0.4 }}
            animate={{ pathLength: [0.15, 1, 1], opacity: [0.5, 1, 0.85] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.path
            d="M22 20.5V35.5L32 44.5L42 35.5V20.5"
            stroke="url(#uniteLoaderGrad)"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0.2 }}
            animate={{ pathLength: [0.2, 1, 0.2] }}
            transition={{ duration: 2.0, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.path
            d="M26.5 30.5L32 25.5L37.5 30.5L32 35.5L26.5 30.5Z"
            stroke="url(#uniteLoaderGrad)"
            strokeWidth="2.2"
            strokeLinejoin="round"
            animate={{ scale: [0.92, 1.08, 0.92] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: '32px 30.5px' }}
          />
        </svg>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.35 }}
        className="relative z-10 mt-6 text-center"
      >
        <div className="text-lg font-bold tracking-tight">Unite</div>
        <div
          className={cn(
            'mt-1.5 text-xs font-medium',
            isLight ? 'text-zinc-700' : 'text-[#94A3B8]',
          )}
        >
          {message}
        </div>
        <div
          className={cn(
            'mt-1 text-[11px]',
            isLight ? 'text-zinc-500' : 'text-[#64748B]',
          )}
        >
          {submessage}
        </div>

        {/* Sleek indeterminate progress shimmer */}
        <div
          className={cn(
            'mx-auto mt-4 h-1 w-44 overflow-hidden rounded-full',
            isLight ? 'bg-black/10' : 'bg-slate-800',
          )}
        >
          <motion.div
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 1.35, repeat: Infinity, ease: 'easeInOut' }}
            className={cn(
              'h-full w-1/2 rounded-full',
              isLight
                ? 'bg-gradient-to-r from-transparent via-black to-transparent'
                : 'bg-gradient-to-r from-transparent via-[#22D3EE] to-transparent',
            )}
          />
        </div>
      </motion.div>
    </div>
  );
}

