import { apiClient } from './client';
import type { AuthResponse, User } from '@/lib/types';

export const authApi = {
  login: async (payload: { email: string; password: string }) => {
    const response = await apiClient.post<AuthResponse>('/auth/login', payload);
    return response.data;
  },
  register: async (payload: { email: string; password: string }) => {
    const response = await apiClient.post<AuthResponse>('/auth/register', payload);
    return response.data;
  },
  getMe: async () => {
    const response = await apiClient.get<{ user: User }>('/auth/me');
    return response.data.user;
  },
};
