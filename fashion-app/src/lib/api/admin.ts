import { apiClient } from './client';
import type { AuditLog, CreditLog, Customer, DashboardResponse, GenerationTask } from '@/lib/types';

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
};
