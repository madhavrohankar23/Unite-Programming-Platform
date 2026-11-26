import { ToastProvider } from '@/components/feedback/ToastContext';
import { AuthProvider } from '@/features/authentication/AuthContext';
import { ThemeProvider } from '@/features/theme/ThemeContext';
import { AppRouter } from './router';

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
