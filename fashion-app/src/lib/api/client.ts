import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/lib/stores/authStore';

export const API_BASE_URL = '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

let refreshPromise: Promise<string | null> | null = null;

apiClient.interceptors.request.use((request) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    request.headers.Authorization = `Bearer ${token}`;
  }
  return request;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const { refreshToken, setAccessToken, clearSession } = useAuthStore.getState();

    if (
      error.response?.status !== 401 ||
      !original ||
      original._retry ||
      !refreshToken ||
      original.url?.includes('/auth/refresh')
    ) {
      if (error.response?.status === 401 && original?.url?.includes('/auth/refresh')) {
        clearSession();
      }
      throw error;
    }

    original._retry = true;

    refreshPromise ??= axios
      .post<{ accessToken: string; refreshToken?: string }>(`${API_BASE_URL}/auth/refresh`, { refreshToken })
      .then((response) => {
        setAccessToken(response.data.accessToken);
        // 如果服务端返回了新的 refreshToken，同步更新
        if (response.data.refreshToken) {
          useAuthStore.setState({ refreshToken: response.data.refreshToken });
        }
        return response.data.accessToken;
      })
      .catch(() => {
        clearSession();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });

    const newToken = await refreshPromise;
    if (!newToken) {
      throw error;
    }

    original.headers.Authorization = `Bearer ${newToken}`;
    return apiClient(original);
  },
);
