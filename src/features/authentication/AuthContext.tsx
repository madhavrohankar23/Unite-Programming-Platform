import type { UserProfileDto } from '@shared/types/models';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AUTH_MODE, getSupabaseClient } from '@/lib/supabase/client';
import { authApi } from '@/services/api/authApi';
import { setApiTokenProvider } from '@/services/api/httpClient';

const LOCAL_TOKEN_KEY = 'unite_access_token';

interface AuthContextValue {
  user: UserProfileDto | null;
  accessToken: string | null;
  loading: boolean;
  authMode: 'supabase' | 'local';
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfileDto | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    AUTH_MODE === 'local' ? localStorage.getItem(LOCAL_TOKEN_KEY) : null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setApiTokenProvider(async () => {
      if (AUTH_MODE === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) return null;
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? null;
      }
      return localStorage.getItem(LOCAL_TOKEN_KEY);
    });
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        if (AUTH_MODE === 'supabase') {
          const supabase = getSupabaseClient();
          if (!supabase) {
            setLoading(false);
            return;
          }
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token ?? null;
          if (!active) return;
          setAccessToken(token);
          if (token) {
            const { user: profile } = await authApi.getMe();
            if (active) setUser(profile);
          }
        } else {
          const saved = localStorage.getItem(LOCAL_TOKEN_KEY);
          if (!saved) {
            if (active) setLoading(false);
            return;
          }
          setAccessToken(saved);
          const { user: profile } = await authApi.getMe();
          if (active) setUser(profile);
        }
      } catch {
        if (AUTH_MODE === 'local') {
          localStorage.removeItem(LOCAL_TOKEN_KEY);
        }
        if (active) {
          setAccessToken(null);
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void bootstrap();

    if (AUTH_MODE === 'supabase') {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
          const token = session?.access_token ?? null;
          setAccessToken(token);
          if (token) {
            try {
              const { user: profile } = await authApi.getMe();
              setUser(profile);
            } catch {
              setUser(null);
            }
          } else {
            setUser(null);
          }
        });
        return () => {
          active = false;
          sub.subscription.unsubscribe();
        };
      }
    }

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (AUTH_MODE === 'supabase') {
      const supabase = getSupabaseClient()!;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        throw new Error(error?.message ?? 'Unable to sign in');
      }
      setAccessToken(data.session.access_token);
      const { user: profile } = await authApi.getMe();
      setUser(profile);
      return;
    }

    const res = await authApi.loginLocal({ email, password });
    localStorage.setItem(LOCAL_TOKEN_KEY, res.accessToken);
    setAccessToken(res.accessToken);
    setUser(res.user);
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    if (AUTH_MODE === 'supabase') {
      const supabase = getSupabaseClient()!;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      });
      if (error) throw new Error(error.message);
      if (data.session) {
        setAccessToken(data.session.access_token);
        const { user: profile } = await authApi.getMe();
        setUser(profile);
      } else {
        throw new Error('Check your email to confirm your account before signing in.');
      }
      return;
    }

    const res = await authApi.registerLocal({ email, password, displayName });
    localStorage.setItem(LOCAL_TOKEN_KEY, res.accessToken);
    setAccessToken(res.accessToken);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    if (AUTH_MODE === 'supabase') {
      const supabase = getSupabaseClient();
      await supabase?.auth.signOut();
    } else {
      localStorage.removeItem(LOCAL_TOKEN_KEY);
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    if (AUTH_MODE === 'supabase') {
      const supabase = getSupabaseClient()!;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw new Error(error.message);
      return;
    }
    throw new Error(
      'Password reset emails require Supabase Auth mode (VITE_AUTH_MODE=supabase).',
    );
  }, []);

  const updateDisplayName = useCallback(async (displayName: string) => {
    const { user: updated } = await authApi.updateProfile({ displayName });
    setUser(updated);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      loading,
      authMode: AUTH_MODE,
      login,
      register,
      logout,
      requestPasswordReset,
      updateDisplayName,
    }),
    [
      user,
      accessToken,
      loading,
      login,
      register,
      logout,
      requestPasswordReset,
      updateDisplayName,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

