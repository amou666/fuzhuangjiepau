'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api/admin';
import type { Customer } from '@/lib/types';
import { getErrorMessage } from '@/lib/utils/api';
import { formatDateTime } from '@/lib/utils/format';
import { hasMinPasswordLength, isValidEmail, normalizeEmail } from '@/lib/utils/validation';
import { Users, Plus, Copy, Pencil, ToggleLeft, ToggleRight, Key, Mail, Lock, Coins, Sparkles } from 'lucide-react';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [initialCredits, setInitialCredits] = useState(20);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingApiKey, setEditingApiKey] = useState('');

  const loadCustomers = async () => {
    try {
      setCustomers(await adminApi.getCustomers());
    } catch (loadError) {
      setError(getErrorMessage(loadError, '加载客户列表失败'));
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, []);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      setError('请输入有效邮箱');
      return;
    }

    if (!hasMinPasswordLength(password)) {
      setError('初始密码至少为 6 位');
      return;
    }

    if (!Number.isInteger(initialCredits) || initialCredits < 0) {
      setError('初始积分必须是大于或等于 0 的整数');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await adminApi.createCustomer({
        email: normalizedEmail,
        password,
        initialCredits,
        apiKey: apiKey.trim() || undefined,
      });
      setEmail('');
      setPassword('');
      setInitialCredits(20);
      setApiKey('');
      await loadCustomers();
    } catch (submitError) {
      setError(getErrorMessage(submitError, '创建客户失败'));
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (customer: Customer) => {
    try {
      await adminApi.updateCustomerStatus(customer.id, !customer.isActive);
      await loadCustomers();
    } catch (submitError) {
      setError(getErrorMessage(submitError, '更新客户状态失败'));
    }
  };

  const startEditApiKey = (customer: Customer) => {
    setEditingCustomerId(customer.id);
    setEditingApiKey(customer.apiKey);
  };

  const cancelEditApiKey = () => {
    setEditingCustomerId(null);
    setEditingApiKey('');
  };

  const saveApiKey = async (customerId: string) => {
    if (!editingApiKey.trim()) {
      setError('API Key 不能为空');
      return;
    }

    try {
      await adminApi.updateCustomerApiKey(customerId, editingApiKey.trim());
      setEditingCustomerId(null);
      setEditingApiKey('');
      await loadCustomers();
    } catch (submitError) {
      setError(getErrorMessage(submitError, '更新 API Key 失败'));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('已复制到剪贴板');
    }).catch(() => {
      alert('复制失败');
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="mb-1">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">客户管理</h1>
        </div>
        <p className="text-gray-500 text-sm ml-[52px]">创建客户、设置 API Key、启用或禁用账号。</p>
      </div>
      
      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium border border-red-100">
          {error}
        </div>
      )}

      <div className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-500" />
          新建客户
        </h2>
        <form className="flex flex-col gap-4" onSubmit={handleCreate}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="customer-email" className="text-[13px] font-semibold text-gray-700 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-gray-400" /> 邮箱 *
            </label>
            <input
              id="customer-email"
              className="w-full px-3.5 py-2.5 bg-white/75 border border-black/10 rounded-[10px] text-sm text-gray-800 transition-all focus:outline-none focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/15 backdrop-blur-sm"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="请输入客户邮箱"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="customer-password" className="text-[13px] font-semibold text-gray-700 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-gray-400" /> 初始密码 *
            </label>
            <input
              id="customer-password"
              className="w-full px-3.5 py-2.5 bg-white/75 border border-black/10 rounded-[10px] text-sm text-gray-800 transition-all focus:outline-none focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/15 backdrop-blur-sm"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="至少 6 位"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="customer-credits" className="text-[13px] font-semibold text-gray-700 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-gray-400" /> 初始积分
            </label>
            <input
              id="customer-credits"
              className="w-full px-3.5 py-2.5 bg-white/75 border border-black/10 rounded-[10px] text-sm text-gray-800 transition-all focus:outline-none focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/15 backdrop-blur-sm"
              type="number"
              min={0}
              step={1}
              value={initialCredits}
              onChange={(event) => setInitialCredits(Math.max(0, Number(event.target.value) || 0))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="customer-api-key" className="text-[13px] font-semibold text-gray-700 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-gray-400" /> AI API Key（可选）
            </label>
            <input
              id="customer-api-key"
              className="w-full px-3.5 py-2.5 bg-white/75 border border-black/10 rounded-[10px] text-sm text-gray-800 transition-all focus:outline-none focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/15 backdrop-blur-sm"
              type="text"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-xxx 格式，留空则自动生成"
            />
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-none rounded-xl text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(59,130,246,0.3)] hover:shadow-[0_4px_16px_rgba(59,130,246,0.4)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            type="submit"
            disabled={loading}
          >
            {loading ? '创建中...' : '创建客户'}
          </button>
        </form>
      </div>

      <div className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-500" />
          客户列表
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">邮箱</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">AI API Key</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">积分</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">任务数</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">状态</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">创建时间</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">操作</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-blue-500/[0.03] transition-colors">
                  <td className="px-4 py-3 border-b border-gray-100 text-gray-700">
                    <div className="font-medium">{customer.email}</div>
                  </td>
                  <td className="px-4 py-3 border-b border-gray-100 text-gray-700">
                    {editingCustomerId === customer.id ? (
                      <div className="flex gap-2 items-center">
                        <input
                          className="w-full px-2 py-1.5 bg-white/75 border border-black/10 rounded-lg text-xs"
                          type="text"
                          value={editingApiKey}
                          onChange={(e) => setEditingApiKey(e.target.value)}
                        />
                        <button
                          className="inline-flex items-center justify-center px-2 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-none rounded-lg text-xs font-semibold"
                          onClick={() => saveApiKey(customer.id)}
                        >
                          保存
                        </button>
                        <button
                          className="inline-flex items-center justify-center px-2 py-1.5 bg-white/70 text-gray-700 border border-black/10 rounded-lg text-xs font-medium backdrop-blur-sm hover:bg-white/90 hover:border-blue-500/30 hover:text-blue-500"
                          onClick={cancelEditApiKey}
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2 items-center">
                        <span className="inline-block px-2.5 py-1 bg-slate-100 rounded-md font-mono text-xs text-slate-600 break-all">{customer.apiKey}</span>
                        <button
                          className="flex items-center gap-1 bg-transparent border-none text-gray-500 cursor-pointer px-2 py-1 rounded-md text-xs hover:bg-gray-100 hover:text-blue-500 transition-colors"
                          onClick={() => copyToClipboard(customer.apiKey)}
                        >
                          <Copy className="w-3 h-3" /> 复制
                        </button>
                        <button
                          className="inline-flex items-center gap-1 px-2 py-1.5 bg-white/70 text-gray-700 border border-black/10 rounded-lg text-xs font-medium backdrop-blur-sm hover:bg-white/90 hover:border-blue-500/30 hover:text-blue-500"
                          onClick={() => startEditApiKey(customer)}
                        >
                          <Pencil className="w-3 h-3" /> 修改
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 border-b border-gray-100 text-gray-700">
                    <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                      <Coins className="w-3.5 h-3.5" />{customer.credits}
                    </span>
                  </td>
                  <td className="px-4 py-3 border-b border-gray-100 text-gray-700">{customer.taskCount}</td>
                  <td className="px-4 py-3 border-b border-gray-100">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${customer.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {customer.isActive ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}
                      {customer.isActive ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-3 border-b border-gray-100 text-gray-500 text-xs">{formatDateTime(customer.createdAt)}</td>
                  <td className="px-4 py-3 border-b border-gray-100">
                    <button
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        customer.isActive
                          ? 'bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 hover:border-red-300'
                          : 'bg-white/70 text-gray-700 border border-black/10 hover:bg-white/90 hover:border-blue-500/30 hover:text-blue-500'
                      }`}
                      type="button"
                      onClick={() => toggleStatus(customer)}
                    >
                      {customer.isActive ? '禁用' : '启用'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
