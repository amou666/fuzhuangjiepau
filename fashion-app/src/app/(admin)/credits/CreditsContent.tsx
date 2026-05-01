'use client'

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api/admin';
import type { CreditLog, Customer } from '@/lib/types';
import { getErrorMessage } from '@/lib/utils/api';
import { formatDateTime } from '@/lib/utils/format';
import { Wallet, ArrowUpCircle, UserCircle, Coins, TrendingUp, TrendingDown, History, ChevronLeft, ChevronRight } from 'lucide-react';

export default function CreditsContent() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [logs, setLogs] = useState<CreditLog[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [amount, setAmount] = useState(20);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const applyData = (customerData: Customer[], logData: CreditLog[]) => {
    setCustomers(customerData);
    setLogs(logData);
    setSelectedUserId((current) => current || customerData[0]?.id || '');
  };

  const loadData = async () => {
    try {
      const [customerData, logData] = await Promise.all([adminApi.getCustomers(), adminApi.getCreditLogs()]);
      applyData(customerData, logData);
    } catch (loadError) {
      setError(getErrorMessage(loadError, '加载积分数据失败'));
    }
  };

  useEffect(() => {
    let cancelled = false;

    Promise.all([adminApi.getCustomers(), adminApi.getCreditLogs()])
      .then(([customerData, logData]) => {
        if (cancelled) {
          return;
        }

        applyData(customerData, logData);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(getErrorMessage(loadError, '加载积分数据失败'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const pagedLogs = logs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleRecharge = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!selectedUserId) {
      setError('请先选择客户');
      return;
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      setError('充值积分必须是大于 0 的整数');
      return;
    }

    try {
      await adminApi.rechargeCredits({ userId: selectedUserId, amount });
      await loadData();
    } catch (submitError) {
      setError(getErrorMessage(submitError, '充值失败'));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="mb-1">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">积分管理</h1>
        </div>
        <p className="text-gray-500 text-sm ml-[52px]">为客户充值并查看全局积分变动日志。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <article className="fashion-glass rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <ArrowUpCircle className="w-4 h-4 text-amber-500" />
            积分充值
          </h2>
          <form className="flex flex-col gap-4 mt-4" onSubmit={handleRecharge}>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="credit-customer" className="text-[13px] font-semibold text-gray-700">选择客户</label>
              <select
                id="credit-customer"
                className="w-full px-3.5 py-2.5 bg-white/75 border border-black/10 rounded-[10px] text-sm text-gray-800 transition-all focus:outline-none focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/15 backdrop-blur-sm"
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
              >
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.email}（当前 {customer.credits}）</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="credit-amount" className="text-[13px] font-semibold text-gray-700 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-gray-400" /> 充值积分
              </label>
              <input
                id="credit-amount"
                className="w-full px-3.5 py-2.5 bg-white/75 border border-black/10 rounded-[10px] text-sm text-gray-800 transition-all focus:outline-none focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/15 backdrop-blur-sm"
                type="number"
                min={1}
                step={1}
                value={amount}
                onChange={(event) => setAmount(Math.max(0, Number(event.target.value) || 0))}
              />
            </div>
            {error ? (
              <div className="bg-[rgba(196,112,112,0.08)] text-red-600 px-4 py-3 rounded-2xl text-sm font-medium border border-red-100">{error}</div>
            ) : null}
            <button
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white border-none rounded-2xl text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(245,158,11,0.3)] hover:shadow-[0_4px_16px_rgba(245,158,11,0.4)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
              type="submit"
              disabled={!customers.length}
            >
              确认充值
            </button>
          </form>
        </article>
        <article className="fashion-glass rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <UserCircle className="w-4 h-4 text-indigo-500" />
            客户余额概览
          </h2>
          <div className="flex flex-col gap-3 mt-4">
            {customers.map((customer) => (
              <div key={customer.id} className="flex items-center justify-between bg-white/50 rounded-2xl px-4 py-3 border border-white/50 hover:bg-white/70 transition-colors">
                <span className="text-sm text-gray-700">{customer.email}</span>
                <strong className="text-amber-600 font-semibold flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5" /> {customer.credits} 积分
                </strong>
              </div>
            ))}
          </div>
        </article>
      </div>

      <section className="fashion-glass rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <History className="w-4 h-4 text-blue-500" />
          积分日志
        </h2>
        <div className="overflow-x-auto mt-4">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">客户</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">变动</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">余额</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">原因</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">时间</th>
              </tr>
            </thead>
            <tbody>
              {pagedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-blue-500/[0.03] transition-colors">
                  <td className="px-4 py-3 border-b border-gray-100 text-gray-700">{log.user?.email ?? '-'}</td>
                  <td className="px-4 py-3 border-b border-gray-100">
                    <span className={`inline-flex items-center gap-1 font-semibold ${log.delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {log.delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {log.delta > 0 ? `+${log.delta}` : log.delta}
                    </span>
                  </td>
                  <td className="px-4 py-3 border-b border-gray-100 text-gray-700">{log.balanceAfter}</td>
                  <td className="px-4 py-3 border-b border-gray-100 text-gray-700">{log.reason}</td>
                  <td className="px-4 py-3 border-b border-gray-100 text-gray-500 text-xs">{formatDateTime(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <span className="text-[13px] text-gray-500">共 {logs.length} 条记录</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 rounded-2xl flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="text-[13px] text-gray-600 tabular-nums min-w-[60px] text-center">{currentPage} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 rounded-2xl flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
