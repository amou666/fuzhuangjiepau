'use client'

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api/admin';
import type { DashboardResponse } from '@/lib/types';
import { formatDateTime } from '@/lib/utils/format';
import { getErrorMessage } from '@/lib/utils/api';
import { Users, Image, Coins, Activity, TrendingUp, Award } from 'lucide-react';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void adminApi
      .getDashboard()
      .then(setData)
      .catch((loadError) => setError(getErrorMessage(loadError, '加载看板失败')));
  }, []);

  const metrics = data ? [
    { label: '客户总数', value: data.summary.customerCount, icon: Users, color: 'from-blue-500 to-blue-600' },
    { label: '生图总量', value: data.summary.taskCount, icon: Image, color: 'from-indigo-500 to-indigo-600' },
    { label: '累计消耗积分', value: data.summary.totalCreditsConsumed, icon: Coins, color: 'from-violet-500 to-violet-600' },
    { label: '活跃客户数', value: data.summary.activeCustomerCount, icon: Activity, color: 'from-emerald-500 to-emerald-600' },
  ] : [];

  const statusLabel: Record<string, string> = {
    completed: '已完成', done: '已完成', processing: '处理中', pending: '排队中',
    describing_model: '描述模特', describing_scene: '描述场景',
    generating: '生成中', failed: '失败',
  };

  const statusColor: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    done: 'bg-green-100 text-green-800',
    processing: 'bg-yellow-100 text-yellow-800',
    pending: 'bg-indigo-100 text-indigo-800',
    describing_model: 'bg-yellow-100 text-yellow-800',
    describing_scene: 'bg-yellow-100 text-yellow-800',
    generating: 'bg-pink-100 text-pink-800',
    failed: 'bg-red-100 text-red-800',
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1.5">管理员看板</h1>
        <p className="m-0 text-gray-500 text-sm">查看客户规模、任务趋势与积分消耗概览。</p>
      </div>

      {error ? <div className="text-red-500 text-sm font-medium">{error}</div> : null}

      {!data ? (
        <div className="text-center py-10 text-gray-400 bg-white/40 rounded-2xl border border-dashed border-black/[0.08]">
          看板数据加载中...
        </div>
      ) : (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-4 gap-5 max-md:grid-cols-2">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex items-center gap-4"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center shadow-lg shrink-0`}>
                  <m.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">{m.label}</div>
                  <div className="text-2xl font-extrabold bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
                    {m.value}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Two columns */}
          <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
            {/* Daily Tasks */}
            <div className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <h2 className="text-base font-semibold text-gray-900 m-0 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                近 7 天生图趋势
              </h2>
              <div className="flex flex-col gap-2">
                {data.dailyTasks.map((item) => (
                  <div
                    key={item.date}
                    className="flex items-center justify-between px-4 py-3 bg-gray-50/80 rounded-xl text-sm"
                  >
                    <span className="text-gray-600">{item.date}</span>
                    <span className="font-bold text-gray-900">{item.count} 次</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Customers */}
            <div className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <h2 className="text-base font-semibold text-gray-900 m-0 mb-4 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                客户积分消耗排行
              </h2>
              <div className="flex flex-col gap-2">
                {data.topCustomers.length ? data.topCustomers.map((item) => (
                  <div
                    key={item.email}
                    className="flex items-center justify-between px-4 py-3 bg-gray-50/80 rounded-xl text-sm"
                  >
                    <span className="text-gray-600">{item.email}</span>
                    <span className="font-bold text-gray-900">{item.spent} 积分</span>
                  </div>
                )) : (
                  <div className="text-center py-6 text-gray-400 text-sm">暂无客户消耗记录</div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Tasks Table */}
          <div className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <h2 className="text-base font-semibold text-gray-900 m-0 mb-4">最近任务</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">客户</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">状态</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">积分</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-blue-500/[0.03] transition-colors">
                      <td className="px-4 py-3 border-b border-gray-100 text-gray-700">{task.user?.email ?? '-'}</td>
                      <td className="px-4 py-3 border-b border-gray-100">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusColor[task.status.toLowerCase()] ?? 'bg-gray-100 text-gray-600'}`}>
                          {statusLabel[task.status.toLowerCase()] ?? task.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-b border-gray-100 text-gray-700">{task.creditCost}</td>
                      <td className="px-4 py-3 border-b border-gray-100 text-gray-500">{formatDateTime(task.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
