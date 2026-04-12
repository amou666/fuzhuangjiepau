import { apiClient } from './client';
import type { ClothingLength, CreditLog, Favorite, FavoriteType, GenerationTask, ModelConfig, SceneConfig, TaskPayload } from '@/lib/types';

export const workspaceApi = {
  createBatchTasks: async (tasks: TaskPayload[]) => {
    const response = await apiClient.post<{ batchId: string; tasks: GenerationTask[] }>('/tasks/batch', { tasks });
    return response.data;
  },
  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await apiClient.post<{ url: string }>('/uploads/image', formData);
    return response.data.url;
  },
  createTask: async (payload: { clothingUrl: string; clothingBackUrl?: string; clothingDetailUrls?: string[]; clothingLength?: ClothingLength; modelConfig: ModelConfig; sceneConfig: SceneConfig }) => {
    const response = await apiClient.post<{ task: GenerationTask }>('/tasks', payload);
    return response.data.task;
  },
  getTask: async (taskId: string) => {
    const response = await apiClient.get<{ task: GenerationTask }>(`/tasks/${taskId}`);
    return response.data.task;
  },
  deleteTask: async (taskId: string) => {
    const response = await apiClient.delete(`/tasks/${taskId}`);
    return response.data;
  },
  upscaleTask: async (taskId: string, factor: number = 2, imageUrl?: string) => {
    const response = await apiClient.post<{ task: GenerationTask }>(`/tasks/${taskId}/upscale`, { factor, imageUrl });
    return response.data.task;
  },
  getRecords: async () => {
    const response = await apiClient.get<{ records: GenerationTask[] }>('/records');
    return response.data.records;
  },
  getBalance: async () => {
    const response = await apiClient.get<{ balance: number }>('/credits/balance');
    return response.data.balance;
  },
  getCreditHistory: async (params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    
    const response = await apiClient.get<{
      logs: CreditLog[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/credits/history?${queryParams.toString()}`);
    return response.data;
  },
  getCreditSummary: async (params?: { startDate?: string; endDate?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    
    const response = await apiClient.get<{
      totalSpent: number;
      totalRecharged: number;
      dailyStats: Array<{ date: string; spent: number; recharged: number }>;
      typeStats: Record<string, number>;
    }>(`/credits/summary?${queryParams.toString()}`);
    return response.data;
  },
  getGenerationStats: async () => {
    const response = await apiClient.get<{
      overview: {
        totalTasks: number;
        successTasks: number;
        failedTasks: number;
        pendingTasks: number;
        successRate: string;
        avgProcessingTime: number;
      };
      modelPreferences: {
        gender: Record<string, number>;
        bodyType: Record<string, number>;
        pose: Record<string, number>;
      };
      scenePreferences: {
        preset: Record<string, number>;
      };
      dailyStats: Array<{ date: string; total: number; success: number; failed: number }>;
    }>('/stats/generation');
    return response.data;
  },
  fuseModels: async (imageUrls: string[], opts?: { weights?: number[]; strategy?: string }) => {
    const response = await apiClient.post<{ resultUrl: string }>('/model-fusion', {
      modelUrls: imageUrls,
      weights: opts?.weights,
      strategy: opts?.strategy,
    });
    return response.data;
  },
  generateModelPortrait: async (modelConfig: Record<string, unknown>, referenceUrl?: string) => {
    const response = await apiClient.post<{ resultUrls: string[]; taskId: string; credits: number }>('/model-fusion/generate', {
      modelConfig,
      referenceUrl,
    });
    return response.data;
  },
  redesign: async (imageUrl: string, mode: string, opts?: { customPrompt?: string; excludedItems?: string[]; constraints?: string; count?: number; refineFrom?: string }) => {
    const response = await apiClient.post<{ resultUrls: string[]; credits: number; generatedItems: string[] }>('/redesign', { imageUrl, mode, customPrompt: opts?.customPrompt, excludedItems: opts?.excludedItems, constraints: opts?.constraints, count: opts?.count, refineFrom: opts?.refineFrom });
    return response.data;
  },
  recognizeMaterial: async (imageUrl: string) => {
    const response = await apiClient.post<{ materialInfo: string }>('/redesign/recognize', { imageUrl });
    return response.data.materialInfo;
  },
  getFavorites: async (type?: FavoriteType) => {
    const params = type ? `?type=${type}` : '';
    const response = await apiClient.get<{ favorites: Favorite[] }>(`/favorites${params}`);
    return response.data.favorites;
  },
  createFavorite: async (payload: { type: FavoriteType; name: string; data: Record<string, unknown>; previewUrl?: string }) => {
    const response = await apiClient.post<{ favorite: Favorite }>('/favorites', payload);
    return response.data.favorite;
  },
  deleteFavorite: async (id: string) => {
    await apiClient.delete(`/favorites/${id}`);
  },
  downloadBatchZip: async (taskIds: string[]) => {
    const response = await apiClient.post('/downloads/batch', { taskIds }, { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const disposition = response.headers['content-disposition'] || '';
    const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/);
    a.download = filenameMatch?.[1] || 'fashion-ai-batch.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
  submitFeedback: async (taskId: string, rating: number, comment?: string) => {
    const response = await apiClient.post(`/tasks/${taskId}/feedback`, { rating, comment });
    return response.data;
  },
  getFeedback: async (taskId: string) => {
    const response = await apiClient.get<{ feedback: { rating: number; comment: string } | null }>(`/tasks/${taskId}/feedback`);
    return response.data.feedback;
  },

  getWatermarkConfig: async () => {
    const response = await apiClient.get<{ enabled: boolean; text: string; position: string; opacity: number; fontSize: number }>('/watermark/apply');
    return response.data;
  },

  getTemplates: async () => {
    const response = await apiClient.get<{ templates: any[] }>('/templates');
    return response.data.templates;
  },

  getNotifications: async () => {
    const response = await apiClient.get<{ notifications: any[]; unreadCount: number }>('/notifications');
    return response.data;
  },
  markNotificationsRead: async (action: 'read_all' | 'read', notificationId?: string) => {
    await apiClient.patch('/notifications', { action, notificationId });
  },
};
