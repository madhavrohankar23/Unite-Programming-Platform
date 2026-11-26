import { motion } from 'framer-motion';
import { FolderGit2, LogIn, LogOut, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UniteLogo } from '@/components/common/UniteLogo';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/authentication/AuthContext';
import { useTheme } from '@/features/theme/ThemeContext';
import { ThemeToggle } from '@/features/theme/ThemeToggle';
import { cn } from '@/lib/utilities/cn';
import { CreateWorkspaceModal } from './CreateWorkspaceModal';
import { JoinWorkspaceModal } from './JoinWorkspaceModal';

export function LandingPage() {
  const { user, logout } = useAuth();
  const { isLight } = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const inviteParam = searchParams.get('invite') ?? searchParams.get('code') ?? '';

  useEffect(() => {
    const intent = searchParams.get('intent');
    if (user && intent === 'create') {
      setCreateOpen(true);
      setSearchParams({}, { replace: true });
    } else if (user && (intent === 'join' || inviteParam)) {
      setJoinOpen(true);
    }
  }, [user, searchParams, inviteParam, setSearchParams]);

  function handleCreateClick() {
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent('/?intent=create')}`);
      return;
    }
    setCreateOpen(true);
  }

  function handleJoinClick() {
    if (!user) {
      const target = inviteParam
        ? `/?intent=join&code=${encodeURIComponent(inviteParam)}`
        : '/?intent=join';
      navigate(`/auth?redirect=${encodeURIComponent(target)}`);
      return;
    }
    setJoinOpen(true);
  }

  return (
    <div
      className={cn(
        'relative flex min-h-screen flex-col overflow-hidden transition-colors duration-300',
        isLight ? 'unite-light-canvas text-black' : 'bg-[#080D17] text-[#F8FAFC]',
      )}
    >
      {/* Subtle animated ambient radial background */}
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0.45, scale: 0.96 }}
        animate={{ opacity: [0.45, 0.7, 0.45], scale: [0.96, 1.04, 0.96] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className={cn(
          'pointer-events-none absolute left-1/2 top-[38%] h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl',
          isLight
            ? 'bg-[radial-gradient(circle,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.02)_45%,transparent_72%)]'
            : 'bg-[radial-gradient(circle,rgba(37,99,235,0.16)_0%,rgba(20,184,166,0.06)_42%,transparent_72%)]',
        )}
      />

      {/* Minimal top-right session + Daylight Mode toggle bar */}
      <header className="relative z-10 flex items-center justify-end gap-2.5 px-6 py-4">
        <ThemeToggle />

        {user ? (
          <div className="flex items-center gap-2.5">
            <Link
              to="/workspaces"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors',
                isLight
                  ? 'border-black/12 bg-white/85 text-black shadow-sm hover:bg-zinc-100'
                  : 'border-slate-400/15 bg-[#0E1523]/80 text-[#E2E8F0] hover:bg-[#141D2D]',
              )}
            >
              <FolderGit2
                className={cn('h-3.5 w-3.5', isLight ? 'text-black' : 'text-[#22D3EE]')}
              />
              Workspaces
            </Link>
            <div
              className={cn(
                'flex items-center gap-2 rounded-xl border py-1 pl-1.5 pr-2.5',
                isLight
                  ? 'border-black/12 bg-white/85 text-black shadow-sm'
                  : 'border-slate-400/12 bg-[#0E1523]/70 text-[#E2E8F0]',
              )}
            >
              <UserAvatar userId={user.id} displayName={user.displayName} size="xs" />
              <span className="hidden text-xs font-medium sm:inline">
                {user.displayName}
              </span>
              <button
                type="button"
                onClick={() => void logout()}
                className={cn(
                  'ml-1 rounded p-1 transition-colors',
                  isLight
                    ? 'text-zinc-500 hover:text-black'
                    : 'text-[#64748B] hover:text-[#F8FAFC]',
                )}
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <Link
            to="/auth"
            className={cn(
              'rounded-xl border px-3.5 py-1.5 text-xs font-medium transition-colors',
              isLight
                ? 'border-black/15 bg-white/90 text-black shadow-sm hover:bg-zinc-100'
                : 'border-slate-400/15 bg-[#0E1523]/80 text-[#94A3B8] hover:bg-[#141D2D] hover:text-[#F8FAFC]',
            )}
          >
            Sign in
          </Link>
        )}
      </header>

      {/* Main centered landing hero matching Unite reference */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="flex flex-col items-center"
        >
          <UniteLogo size="lg" className="mb-5" />

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Unite</h1>

          <p
            className={cn(
              'mt-3 max-w-xs text-sm leading-relaxed sm:max-w-sm sm:text-base',
              isLight ? 'text-zinc-600' : 'text-[#94A3B8]',
            )}
          >
            Real-time collaborative code editing
            <br />
            for teams
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="primary"
              size="lg"
              onClick={handleCreateClick}
              className="min-w-[172px]"
            >
              <Plus className="h-4 w-4" />
              Create Workspace
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={handleJoinClick}
              className="min-w-[164px]"
            >
              <LogIn className={cn('h-4 w-4', isLight ? 'text-zinc-600' : 'text-[#94A3B8]')} />
              Join Workspace
            </Button>
          </div>
        </motion.div>
      </main>

      <CreateWorkspaceModal open={createOpen} onOpenChange={setCreateOpen} />
      <JoinWorkspaceModal
        open={joinOpen}
        onOpenChange={setJoinOpen}
        initialCode={inviteParam}
      />
    </div>
  );
}
