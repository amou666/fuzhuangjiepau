import { apiClient } from './client';
import type { AuditLog, CreditLog, Customer, DashboardResponse, GenerationTask, NotificationRow, TaskFeedback, Template, PosePreset } from '@/lib/types';
import { useAuthStore } from '@/lib/stores/authStore';

export const adminApi = {
  getDashboard: async () => {
    const response = await apiClient.get<DashboardResponse>('/admin/dashboard');
    return response.data;
  },
  getCustomers: async () => {
    const response = await apiClient.get<{ customers: Customer[] }>('/admin/customers');
    return response.data.customers;
  },
  createCustomer: async (payload: { email: string; password: string; initialCredits: number; apiKey?: string }) => {
    const response = await apiClient.post<{ customer: Customer }>('/admin/customers', payload);
    return response.data.customer;
  },
  updateCustomerStatus: async (id: string, isActive: boolean) => {
    const response = await apiClient.patch<{ customer: Customer }>(`/admin/customers/${id}/status`, { isActive });
    return response.data.customer;
  },
  updateCustomerApiKey: async (id: string, apiKey: string) => {
    const response = await apiClient.patch<{ customer: Customer }>(`/admin/customers/${id}/api-key`, { apiKey });
    return response.data.customer;
  },
  rechargeCredits: async (payload: { userId: string; amount: number }) => {
    const response = await apiClient.post('/admin/credits/recharge', payload);
    return response.data;
  },
  getCreditLogs: async () => {
    const response = await apiClient.get<{ logs: CreditLog[] }>('/admin/credits/logs');
    return response.data.logs;
  },
  getRecords: async () => {
    const response = await apiClient.get<{ records: GenerationTask[] }>('/admin/records');
    return response.data.records;
  },
  getAuditLogs: async () => {
    const response = await apiClient.get<{ logs: AuditLog[] }>('/admin/audit-logs');
    return response.data.logs;
  },
  batchRecharge: async (userIds: string[], amount: number) => {
    const response = await apiClient.post<{ results: { userId: string; email: string; newBalance: number }[]; count: number }>('/admin/credits/batch-recharge', { userIds, amount });
    return response.data;
  },
  sendNotification: async (payload: { title: string; content?: string; type?: string; targetUserIds?: string[] }) => {
    const response = await apiClient.post<{ ids: string[]; count: number }>('/admin/notifications', payload);
    return response.data;
  },
  getNotifications: async () => {
    const response = await apiClient.get<{ notifications: any[] }>('/admin/notifications');
    return response.data.notifications;
  },
  getFeedbackSummary: async () => {
    const response = await apiClient.get<{
      summary: { total: number; avgRating: number; positiveCount: number; negativeCount: number };
      distribution: Array<{ rating: number; count: number }>;
      recent: any[];
    }>('/admin/feedback');
    return response.data;
  },

  getSystemConfig: async () => {
    const response = await apiClient.get<{
      systemConfig: {
        aiModel: string;
        defaultAiModel: string;
        analysisModel: string;
        defaultAnalysisModel: string;
      };
    }>('/admin/system-config');
    return response.data.systemConfig;
  },
  updateSystemConfig: async (payload: { aiModel?: string; analysisModel?: string }) => {
    const response = await apiClient.put<{
      success: boolean;
      systemConfig: {
        aiModel: string;
        defaultAiModel: string;
        analysisModel: string;
        defaultAnalysisModel: string;
      };
    }>('/admin/system-config', payload);
    return response.data.systemConfig;
  },

  getWatermark: async () => {
    const response = await apiClient.get<{ watermark: { enabled: boolean; text: string; position: string; opacity: number; fontSize: number } }>('/admin/watermark');
    return response.data.watermark;
  },
  updateWatermark: async (config: { enabled: boolean; text: string; position: string; opacity: number; fontSize: number }) => {
    await apiClient.put('/admin/watermark', config);
  },

  getTemplates: async () => {
    const response = await apiClient.get<{ templates: any[] }>('/admin/templates');
    return response.data.templates;
  },
  createTemplate: async (payload: { name: string; description?: string; category?: string; previewUrl?: string; clothingUrl?: string; modelConfig?: Record<string, any>; sceneConfig?: Record<string, any> }) => {
    const response = await apiClient.post<{ template: any }>('/admin/templates', payload);
    return response.data.template;
  },
  updateTemplate: async (id: string, payload: Record<string, any>) => {
    const response = await apiClient.patch<{ template: any }>(`/admin/templates/${id}`, payload);
    return response.data.template;
  },
  deleteTemplate: async (id: string) => {
    await apiClient.delete(`/admin/templates/${id}`);
  },

  // ─── 姿势预设管理 ───
  getPosePresets: async () => {
    const response = await apiClient.get<{ posePresets: PosePreset[] }>('/admin/pose-presets');
    return response.data.posePresets;
  },
  createPosePreset: async (payload: { category: string; label: string; prompt?: string; thumbnailUrl?: string; sortOrder?: number }) => {
    const response = await apiClient.post<{ posePreset: PosePreset }>('/admin/pose-presets', payload);
    return response.data.posePreset;
  },
  updatePosePreset: async (id: string, payload: Record<string, unknown>) => {
    const response = await apiClient.patch<{ posePreset: PosePreset }>(`/admin/pose-presets/${id}`, payload);
    return response.data.posePreset;
  },
  deletePosePreset: async (id: string) => {
    await apiClient.delete(`/admin/pose-presets/${id}`);
  },
  generatePosePrompt: async (label: string, category: string) => {
    const response = await apiClient.post<{ prompt: string }>('/admin/pose-presets/generate-prompt', { label, category });
    return response.data.prompt;
  },

  exportCSV: async (type: 'customers' | 'tasks' | 'credits') => {
    const { accessToken } = useAuthStore.getState()
    const response = await fetch(`/api/admin/export?type=${type}`, {
      headers: { Authorization: `Bearer ${accessToken || ''}` },
    });
    if (!response.ok) throw new Error('导出失败');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
