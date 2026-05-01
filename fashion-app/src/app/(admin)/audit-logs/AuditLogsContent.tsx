'use client'

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api/admin';
import type { AuditLog } from '@/lib/types';
import { formatDateTime } from '@/lib/utils/format';
import { getErrorMessage } from '@/lib/utils/api';
import { ShieldCheck, Loader2 } from 'lucide-react';

const actionLabels: Record<string, string> = {
  recharge_credits: '充值积分',
  create_customer: '创建客户',
  toggle_customer_status: '切换账号状态',
  update_api_key: '更新 API Key',
  delete_record: '删除记录',
};

const actionColors: Record<string, string> = {
  recharge_credits: 'bg-green-100 text-green-800',
  create_customer: 'bg-blue-100 text-blue-800',
  toggle_customer_status: 'bg-yellow-100 text-yellow-800',
  update_api_key: 'bg-purple-100 text-purple-800',
  delete_record: 'bg-red-100 text-red-800',
};

export default function AuditLogsContent() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi
      .getAuditLogs()
      .then(setLogs)
      .catch((err) => setError(getErrorMessage(err, '加载审计日志失败')))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1.5 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-indigo-500" />
          操作审计日志
        </h1>
        <p className="m-0 text-gray-500 text-sm">记录所有管理员的敏感操作，方便溯源与审查。</p>
      </div>

      {error ? <div className="text-red-500 text-sm font-medium">{error}</div> : null}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 bg-white/40 rounded-2xl border border-dashed border-black/[0.08]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载中...
        </div>
      ) : logs.length === 0 && !error ? (
        <div className="text-center py-10 text-gray-400 bg-white/40 rounded-2xl border border-dashed border-black/[0.08]">
          暂无审计日志。
        </div>
      ) : (
        <div className="overflow-x-auto fashion-glass rounded-2xl">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">时间</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">操作类型</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">操作管理员</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">目标用户</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">详情</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-blue-500/[0.03] transition-colors">
                  <td className="px-4 py-3 border-b border-gray-100 text-gray-500 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                  <td className="px-4 py-3 border-b border-gray-100">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${actionColors[log.action] ?? 'bg-yellow-100 text-yellow-800'}`}>
                      {actionLabels[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 border-b border-gray-100 text-gray-700">{log.admin.email}</td>
                  <td className="px-4 py-3 border-b border-gray-100 text-gray-700">{log.targetUser?.email ?? '-'}</td>
                  <td className="px-4 py-3 border-b border-gray-100 text-gray-500 text-[13px]">{log.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
