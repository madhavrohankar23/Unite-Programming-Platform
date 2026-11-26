import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, KeyRound, Mail, User } from 'lucide-react';
import { UniteLogo } from '@/components/common/UniteLogo';
import { useToast } from '@/components/feedback/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useTheme } from '@/features/theme/ThemeContext';
import { ThemeToggle } from '@/features/theme/ThemeToggle';
import { cn } from '@/lib/utilities/cn';
import { useAuth } from './AuthContext';

type AuthTab = 'login' | 'register' | 'reset';

export function AuthPage() {
  const { user, login, register, requestPasswordReset, authMode } = useAuth();
  const { isLight } = useTheme();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const redirectTo =
    searchParams.get('redirect') ||
    (location.state as { from?: string } | null)?.from ||
    '/workspaces';

  const [tab, setTab] = useState<AuthTab>(
    searchParams.get('mode') === 'register' ? 'register' : 'login',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (tab === 'login') {
        await login(email.trim(), password);
        notify({ kind: 'success', title: 'Signed in to Unite' });
        navigate(redirectTo, { replace: true });
      } else if (tab === 'register') {
        await register(email.trim(), password, displayName.trim());
        notify({ kind: 'success', title: 'Account created', description: 'Welcome to Unite.' });
        navigate(redirectTo, { replace: true });
      } else {
        await requestPasswordReset(email.trim());
        notify({
          kind: 'success',
          title: 'Reset email sent',
          description: 'Check your inbox for password recovery instructions.',
        });
        setTab('login');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={cn(
        'relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12 transition-colors duration-300',
        isLight ? 'unite-light-canvas text-black' : 'bg-[#080D17] text-[#F8FAFC]',
      )}
    >
      <div className="absolute right-6 top-4 z-20">
        <ThemeToggle />
      </div>

      <div
        className={cn(
          'pointer-events-none absolute left-1/2 top-1/3 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]',
          isLight ? 'bg-black/5' : 'bg-blue-600/10',
        )}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md">
        <Link
          to="/"
          className={cn(
            'mb-6 inline-flex items-center gap-2 text-xs font-medium transition-colors',
            isLight ? 'text-zinc-600 hover:text-black' : 'text-[#94A3B8] hover:text-[#F8FAFC]',
          )}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Unite
        </Link>

        <div
          className={cn(
            'rounded-2xl border p-7 backdrop-blur-md',
            isLight
              ? 'unite-light-card border-black/12'
              : 'border-slate-400/15 bg-[#0E1523]/90 shadow-unite-panel',
          )}
        >
          <div className="mb-6 flex flex-col items-center text-center">
            <UniteLogo size="md" className="mb-3" />
            <h1 className="text-xl font-bold tracking-tight">
              {tab === 'login'
                ? 'Sign in to Unite'
                : tab === 'register'
                  ? 'Create your Unite account'
                  : 'Reset your password'}
            </h1>
            <p className={cn('mt-1 text-xs', isLight ? 'text-zinc-600' : 'text-[#94A3B8]')}>
              Real-time collaborative code editing for teams
            </p>
          </div>

          {tab !== 'reset' && (
            <div
              className={cn(
                'mb-5 grid grid-cols-2 rounded-xl border p-1',
                isLight
                  ? 'border-black/10 bg-zinc-100'
                  : 'border-slate-400/10 bg-[#080D17]/80',
              )}
            >
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setError(null);
                }}
                className={cn(
                  'rounded-lg py-2 text-xs font-medium transition-colors',
                  tab === 'login'
                    ? isLight
                      ? 'bg-white text-black shadow-sm'
                      : 'bg-[#141D2D] text-[#F8FAFC] shadow-sm'
                    : isLight
                      ? 'text-zinc-600 hover:text-black'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]',
                )}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setError(null);
                }}
                className={cn(
                  'rounded-lg py-2 text-xs font-medium transition-colors',
                  tab === 'register'
                    ? isLight
                      ? 'bg-white text-black shadow-sm'
                      : 'bg-[#141D2D] text-[#F8FAFC] shadow-sm'
                    : isLight
                      ? 'text-zinc-600 hover:text-black'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]',
                )}
              >
                Create Account
              </button>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-[#EF4444]/35 bg-[#EF4444]/10 px-3.5 py-2.5 text-xs text-red-500"
            >
              {error}
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {tab === 'register' && (
              <div className="relative">
                <Input
                  label="Display Name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={60}
                  placeholder="Alex Rivera"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <User className="pointer-events-none absolute right-3 top-[33px] h-4 w-4 opacity-50" />
              </div>
            )}

            <div className="relative">
              <Input
                label="Email Address"
                type="email"
                required
                autoComplete="email"
                placeholder="alex@team.dev"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Mail className="pointer-events-none absolute right-3 top-[33px] h-4 w-4 opacity-50" />
            </div>

            {tab !== 'reset' && (
              <div className="relative">
                <Input
                  label="Password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <KeyRound className="pointer-events-none absolute right-3 top-[33px] h-4 w-4 opacity-50" />
              </div>
            )}

            <Button type="submit" variant="primary" className="w-full" loading={submitting}>
              {tab === 'login'
                ? 'Sign In'
                : tab === 'register'
                  ? 'Create Account'
                  : 'Send Reset Link'}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between text-xs opacity-70">
            <span>
              Auth mode: <strong>{authMode}</strong>
            </span>
            {tab === 'login' && authMode === 'supabase' && (
              <button
                type="button"
                onClick={() => {
                  setTab('reset');
                  setError(null);
                }}
                className="underline"
              >
                Forgot password?
              </button>
            )}
            {tab === 'reset' && (
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setError(null);
                }}
                className="underline"
              >
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
