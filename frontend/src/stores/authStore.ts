import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (payload: { user: User; accessToken: string; refreshToken: string }) => void;
  setUser: (user: User) => void;
  setAccessToken: (accessToken: string | null) => void;
  updateCredits: (credits: number) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setSession: ({ user, accessToken, refreshToken }) =>
        set({ user, accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      updateCredits: (credits) =>
        set((state) => ({
          user: state.user ? { ...state.user, credits } : state.user,
        })),
      clearSession: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: 'fashion-ai-auth',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
