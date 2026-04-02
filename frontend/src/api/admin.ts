import { apiClient } from './client';
import type { AuditLog, CreditLog, Customer, DashboardResponse, GenerationTask } from '../types';

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
  getKeywordsStats: async (params?: { startDate?: string; endDate?: string; limit?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const response = await apiClient.get<{
      topKeywords: Array<{ keyword: string; count: number; type: string }>;
      typeGroups: Record<string, Array<{ keyword: string; count: number }>>;
      weeklyTrends: Array<{ week: string; keywords: Record<string, number> }>;
      totalTasks: number;
    }>(`/admin/stats/keywords?${queryParams.toString()}`);
    return response.data;
  },
  getRevenueStats: async (params?: { startDate?: string; endDate?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    
    const response = await apiClient.get<{
      totalRevenue: number;
      dailyRevenue: Array<{ date: string; revenue: number }>;
      monthlyRevenue: Array<{ month: string; revenue: number }>;
      revenueByType: Record<string, number>;
      customerAnalysis: {
        newCustomerRevenue: number;
        oldCustomerRevenue: number;
        newCustomerPercentage: string;
      };
      topUsers: Array<{ userId: string; email: string; revenue: number }>;
      transactionCount: number;
    }>(`/admin/stats/revenue?${queryParams.toString()}`);
    return response.data;
  },
};
