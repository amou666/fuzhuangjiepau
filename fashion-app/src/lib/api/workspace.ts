import { apiClient } from './client';
import type { CreditLog, Favorite, FavoriteType, GenerationTask, QuickWorkspaceAspectRatio, QuickWorkspaceFraming, QuickWorkspaceMode } from '@/lib/types';
import type { BatchVariationType, PoseCategory } from '@/lib/components/lookbook/pose-presets';

export const workspaceApi = {
  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await apiClient.post<{ url: string }>('/uploads/image', formData);
    return response.data.url;
  },
  createQuickWorkspaceTask: async (payload: {
    clothingUrl: string;
    clothingBackUrl?: string;
    modelImageUrl?: string;
    sceneImageUrl: string;
    mode: QuickWorkspaceMode;
    aspectRatio?: QuickWorkspaceAspectRatio;
    framing?: QuickWorkspaceFraming;
    device?: string;
    extraPrompt?: string;
  }) => {
    const response = await apiClient.post<{ task: GenerationTask }>('/quick-workspace', payload);
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
  getRecords: async (params?: { page?: number; limit?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    const qs = queryParams.toString();
    const response = await apiClient.get<{ records: GenerationTask[] }>(`/records${qs ? `?${qs}` : ''}`);
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
  generateModelPortrait: async (modelConfig: Record<string, unknown>, referenceUrl?: string, extraPrompt?: string) => {
    const response = await apiClient.post<{ resultUrls: string[]; taskId: string; credits: number }>('/model-fusion/generate', {
      modelConfig,
      referenceUrl,
      extraPrompt,
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
  analyzeGarmentParts: async (imageUrl: string) => {
    const response = await apiClient.post<{
      parts: Array<{ id: string; name: string; defaultChecked: boolean }>
      materialInfo: string
      currentColor: string
    }>('/recolor/analyze-parts', { imageUrl });
    return response.data;
  },
  recolorByColor: async (imageUrl: string, colorMappings: Array<{
    sourceHex: string; sourceName: string; sourceHue: number; sourceLightMin: number; sourceLightMax: number; sourceGradient: string[];
    targetName: string; targetHex: string;
  }>, opts?: { brightness?: number; saturation?: number }) => {
    const response = await apiClient.post<{ resultUrl: string; taskId: string; credits: number }>('/recolor', {
      imageUrl,
      colorMappings,
      brightness: opts?.brightness,
      saturation: opts?.saturation,
    });
    return response.data;
  },
  recolorPerPart: async (imageUrl: string, partsWithColors: Array<{ partId: string; partName: string; color: { name: string; hex: string } }>, opts?: { brightness?: number; saturation?: number }) => {
    const response = await apiClient.post<{ resultUrl: string; taskId: string; credits: number }>('/recolor', {
      imageUrl,
      partsWithColors,
      brightness: opts?.brightness,
      saturation: opts?.saturation,
    });
    return response.data;
  },
  analyzeProductionSheet: async (imageUrl: string) => {
    const response = await apiClient.post<{
      styleName: string
      material: string
      accessories: string
      length: number
      chest: number
      shoulder: number
      sleeve: number
      bottom: number
      credits: number
    }>('/production-sheet/analyze', { imageUrl });
    return response.data;
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

  createLookBookBatch: async (payload: {
    clothingUrl: string;
    clothingBackUrl?: string;
    /** 融合模式下可选：不传则保留场景图中的原模特，仅换衣服 */
    modelImageUrl?: string;
    sceneImageUrl: string;
    mode: QuickWorkspaceMode;
    aspectRatio?: QuickWorkspaceAspectRatio;
    framing?: QuickWorkspaceFraming;
    device?: string;
    extraPrompt?: string;
    batchVariation?: BatchVariationType;
    poseHints?: string[];
    count?: number;
  }) => {
    const response = await apiClient.post<{ taskIds: string[]; count: number; creditCost: number }>('/lookbook', payload);
    return response.data;
  },

  getPosePresets: async (): Promise<PoseCategory[]> => {
    const response = await apiClient.get<{ categories: PoseCategory[] }>('/pose-presets');
    return response.data.categories || [];
  },
};
