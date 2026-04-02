import { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin';
import type { AuditLog } from '../../types';
import { formatDateTime } from '../../utils/format';
import { getErrorMessage } from '../../utils/api';

const actionLabels: Record<string, string> = {
  recharge_credits: '充值积分',
  create_customer: '创建客户',
  toggle_customer_status: '切换账号状态',
  update_api_key: '更新 API Key',
  delete_record: '删除记录',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi
      .getAuditLogs()
      .then(setLogs)
      .catch((err) => setError(getErrorMessage(err, '加载审计日志失败')));
  }, []);

  return (
    <div className="list-stack">
      <div className="page-header">
        <h1>操作审计日志</h1>
        <p>记录所有管理员的敏感操作，方便溯源与审查。</p>
      </div>

      {error ? <div className="error-text">{error}</div> : null}

      {logs.length === 0 && !error ? (
        <div className="empty-card">暂无审计日志。</div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>时间</th>
                <th>操作类型</th>
                <th>操作管理员</th>
                <th>目标用户</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(log.createdAt)}</td>
                  <td>
                    <span className="status-pill status-processing">
                      {actionLabels[log.action] ?? log.action}
                    </span>
                  </td>
                  <td>{log.admin.email}</td>
                  <td>{log.targetUser?.email ?? '-'}</td>
                  <td style={{ color: 'var(--gray-600)', fontSize: '13px' }}>{log.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
