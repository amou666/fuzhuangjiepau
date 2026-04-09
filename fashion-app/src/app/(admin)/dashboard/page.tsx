'use client'

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api/admin';
import type { DashboardResponse } from '@/lib/types';
import { formatDateTime } from '@/lib/utils/format';
import { getErrorMessage } from '@/lib/utils/api';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void adminApi
      .getDashboard()
      .then(setData)
      .catch((loadError) => setError(getErrorMessage(loadError, '加载看板失败')));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>管理员看板</h1>
          <p>查看客户规模、任务趋势与积分消耗概览。</p>
        </div>
      </div>
      {error ? <div className="error-text">{error}</div> : null}
      {!data ? (
        <div className="empty-card">看板数据加载中...</div>
      ) : (
        <>
          <section className="metrics-grid">
            <article className="metric-card">
              <div className="metric-label">客户总数</div>
              <div className="metric-value">{data.summary.customerCount}</div>
            </article>
            <article className="metric-card">
              <div className="metric-label">生图总量</div>
              <div className="metric-value">{data.summary.taskCount}</div>
            </article>
            <article className="metric-card">
              <div className="metric-label">累计消耗积分</div>
              <div className="metric-value">{data.summary.totalCreditsConsumed}</div>
            </article>
            <article className="metric-card">
              <div className="metric-label">活跃客户数</div>
              <div className="metric-value">{data.summary.activeCustomerCount}</div>
            </article>
          </section>
          <section className="two-column">
            <article className="table-card">
              <h2 className="card-title">近 7 天生图趋势</h2>
              <div className="list-stack" style={{ marginTop: 16 }}>
                {data.dailyTasks.map((item) => (
                  <div key={item.date} className="panel inline-actions" style={{ justifyContent: 'space-between' }}>
                    <span>{item.date}</span>
                    <strong>{item.count} 次</strong>
                  </div>
                ))}
              </div>
            </article>
            <article className="table-card">
              <h2 className="card-title">客户积分消耗排行</h2>
              <div className="list-stack" style={{ marginTop: 16 }}>
                {data.topCustomers.length ? data.topCustomers.map((item) => (
                  <div key={item.email} className="panel inline-actions" style={{ justifyContent: 'space-between' }}>
                    <span>{item.email}</span>
                    <strong>{item.spent} 积分</strong>
                  </div>
                )) : <div className="empty-card">暂无客户消耗记录</div>}
              </div>
            </article>
          </section>
          <section className="table-card" style={{ marginTop: 20 }}>
            <h2 className="card-title">最近任务</h2>
            <div className="table-wrapper" style={{ marginTop: 16 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>客户</th>
                    <th>状态</th>
                    <th>积分</th>
                    <th>创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentTasks.map((task) => (
                    <tr key={task.id}>
                      <td>{task.user?.email ?? '-'}</td>
                      <td><span className={`status-pill status-${task.status.toLowerCase()}`}>{task.status}</span></td>
                      <td>{task.creditCost}</td>
                      <td>{formatDateTime(task.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
