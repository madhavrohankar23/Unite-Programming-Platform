import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { FullScreenLoader } from '@/components/feedback/FullScreenLoader';
import { useAuth } from './AuthContext';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullScreenLoader message="Verifying session..." />;
  }

  if (!user) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/auth?redirect=${redirect}`} replace />;
  }

  return <>{children}</>;
}

