import { apiClient } from './client';
import type { ClothingLength, CreditLog, GenerationTask, ModelConfig, SceneConfig } from '@/lib/types';

export const workspaceApi = {
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
  fuseModels: async (imageUrls: string[]) => {
    const response = await apiClient.post<{ resultUrl: string }>('/model-fusion', { modelUrls: imageUrls });
    return response.data;
  },
  redesign: async (imageUrl: string, mode: string, customPrompt?: string, excludedItems?: string[]) => {
    const response = await apiClient.post<{ resultUrls: string[]; credits: number; generatedItems: string[] }>('/redesign', { imageUrl, mode, customPrompt, excludedItems });
    return response.data;
  },
  recognizeMaterial: async (imageUrl: string) => {
    const response = await apiClient.post<{ materialInfo: string }>('/redesign/recognize', { imageUrl });
    return response.data.materialInfo;
  },
};
