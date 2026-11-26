import type { UserProfileDto } from '@shared/types/models';
import { apiFetch } from './httpClient';

export interface LocalAuthResponse {
  accessToken: string;
  user: UserProfileDto;
}

export const authApi = {
  registerLocal(payload: { email: string; password: string; displayName: string }) {
    return apiFetch<LocalAuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
    });
  },
  loginLocal(payload: { email: string; password: string }) {
    return apiFetch<LocalAuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
    });
  },
  getMe() {
    return apiFetch<{ user: UserProfileDto }>('/auth/me');
  },
  updateProfile(payload: { displayName: string; avatarUrl?: string | null }) {
    return apiFetch<{ user: UserProfileDto }>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};

