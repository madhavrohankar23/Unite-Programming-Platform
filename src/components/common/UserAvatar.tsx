import { cn } from '@/lib/utilities/cn';
import { getCollaboratorColor, getInitials } from '@/lib/utilities/colors';

interface UserAvatarProps {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  color?: string;
  size?: 'xs' | 'sm' | 'md';
  showOnlineDot?: boolean;
  className?: string;
}

export function UserAvatar({
  userId,
  displayName,
  avatarUrl,
  color,
  size = 'sm',
  showOnlineDot = false,
  className,
}: UserAvatarProps) {
  const resolvedColor = color ?? getCollaboratorColor(userId);
  const sizeClass =
    size === 'xs'
      ? 'h-6 w-6 text-[10px]'
      : size === 'md'
        ? 'h-9 w-9 text-xs'
        : 'h-7 w-7 text-[11px]';

  return (
    <div className={cn('relative inline-flex shrink-0', className)} title={displayName}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          className={cn(
            'rounded-full border border-slate-400/20 object-cover',
            sizeClass,
          )}
        />
      ) : (
        <div
          className={cn(
            'flex items-center justify-center rounded-full border font-semibold tracking-tight text-slate-950',
            sizeClass,
          )}
          style={{
            backgroundColor: resolvedColor,
            borderColor: 'rgba(248, 250, 252, 0.22)',
          }}
        >
          {getInitials(displayName)}
        </div>
      )}
      {showOnlineDot && (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0E1523] bg-[#22C55E]"
          aria-label="Online"
        />
      )}
    </div>
  );
}

