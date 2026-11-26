import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthPage } from '@/features/authentication/AuthPage';
import { ProtectedRoute } from '@/features/authentication/ProtectedRoute';
import { WorkspaceIdePage } from '@/features/ide/WorkspaceIdePage';
import { LandingPage } from '@/features/landing/LandingPage';
import { JoinRoutePage } from '@/features/workspaces/JoinRoutePage';
import { WorkspacesPage } from '@/features/workspaces/WorkspacesPage';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/workspaces"
          element={
            <ProtectedRoute>
              <WorkspacesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/join"
          element={
            <ProtectedRoute>
              <JoinRoutePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace/:workspaceId"
          element={
            <ProtectedRoute>
              <WorkspaceIdePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

