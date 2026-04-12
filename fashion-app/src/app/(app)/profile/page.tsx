'use client'

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api/auth';
import { workspaceApi } from '@/lib/api/workspace';
import { useAuthStore } from '@/lib/stores/authStore';
import type { CreditLog } from '@/lib/types';
import { getErrorMessage } from '@/lib/utils/api';
import { formatDateTime } from '@/lib/utils/format';
import { Mail, Shield, Key, Coins, Info, ArrowUp, ArrowDown } from 'lucide-react';

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const updateCredits = useAuthStore((state) => state.updateCredits);
  const [logs, setLogs] = useState<CreditLog[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([authApi.getMe(), workspaceApi.getBalance(), workspaceApi.getCreditHistory()])
      .then(([me, balance, history]) => {
        setUser(me);
        updateCredits(balance);
        setLogs(history.logs);
      })
      .catch((loadError) => setError(getErrorMessage(loadError, '加载个人中心失败')));
  }, [setUser, updateCredits]);

  const infoItems = [
    { label: '邮箱', value: user?.email, icon: Mail },
    { label: '角色', value: user?.role, icon: Shield },
    { label: 'ApiKey', value: user?.apiKey ?? '-', icon: Key, mono: true },
    { label: '积分余额', value: String(user?.credits ?? 0), icon: Coins },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1.5">个人中心</h1>
        <p className="m-0 text-gray-500 text-sm">查看账号信息、ApiKey 与积分变动记录。</p>
      </div>

      {error ? <div className="text-red-500 text-sm font-medium">{error}</div> : null}

      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        <div className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-col gap-4">
          <h2 className="text-base font-semibold text-gray-900 m-0">账号信息</h2>
          {infoItems.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <item.icon className="w-4 h-4 text-gray-500" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{item.label}</div>
                <div className={`text-sm text-gray-800 truncate ${item.mono ? 'font-mono bg-gray-100 px-2 py-0.5 rounded' : ''}`}>
                  {item.value}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-col gap-4">
          <h2 className="text-base font-semibold text-gray-900 m-0 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500" />
            使用提示
          </h2>
          <div className="px-4 py-3 bg-amber-50/80 border border-amber-200/50 rounded-xl text-sm text-amber-800 leading-relaxed">
            生图功能使用你专属的 AI API Key，请联系管理员获取或配置。
          </div>
          <div className="px-4 py-3 bg-blue-50/80 border border-blue-200/50 rounded-xl text-sm text-blue-800 leading-relaxed">
            若积分不足，请联系管理员在后台&ldquo;积分管理&rdquo;中为你充值。
          </div>
        </div>
      </div>

      {/* Credit History Table */}
      <div className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <h2 className="text-base font-semibold text-gray-900 m-0 mb-4">积分记录</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">变动</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">余额</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">原因</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">时间</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-blue-500/[0.03] transition-colors">
                  <td className="px-4 py-3 border-b border-gray-100">
                    <span className={`inline-flex items-center gap-1 font-semibold ${log.delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {log.delta > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                      {log.delta > 0 ? `+${log.delta}` : log.delta}
                    </span>
                  </td>
                  <td className="px-4 py-3 border-b border-gray-100 text-gray-700">{log.balanceAfter}</td>
                  <td className="px-4 py-3 border-b border-gray-100 text-gray-600">{log.reason}</td>
                  <td className="px-4 py-3 border-b border-gray-100 text-gray-400">{formatDateTime(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
