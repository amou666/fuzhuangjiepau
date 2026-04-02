import { useEffect, useState } from 'react';
import { workspaceApi } from '../../api/workspace';
import type { CreditLog } from '../../types';
import { getErrorMessage } from '../../utils/api';
import { formatDateTime } from '../../utils/format';

type GenerationStats = {
  overview: {
    totalTasks: number;
    successTasks: number;
    failedTasks: number;
    pendingTasks: number;
    successRate: string;
    avgProcessingTime: number;
  };
  modelPreferences: {
    gender: Record<string, number>;
    bodyType: Record<string, number>;
    pose: Record<string, number>;
  };
  scenePreferences: {
    preset: Record<string, number>;
  };
  dailyStats: Array<{ date: string; total: number; success: number; failed: number }>;
};

export default function StatsPage() {
  const [activeTab, setActiveTab] = useState<'credits' | 'generation'>('credits');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<{
    totalSpent: number;
    totalRecharged: number;
    dailyStats: Array<{ date: string; spent: number; recharged: number }>;
    typeStats: Record<string, number>;
  } | null>(null);
  const [generationStats, setGenerationStats] = useState<GenerationStats | null>(null);
  const [logs, setLogs] = useState<CreditLog[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadData();
  }, [pagination.page, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'credits') {
        const [summaryData, historyData] = await Promise.all([
          workspaceApi.getCreditSummary(
            startDate || endDate
              ? {
                  startDate: startDate || undefined,
                  endDate: endDate || undefined,
                }
              : undefined,
          ),
          workspaceApi.getCreditHistory({
            page: pagination.page,
            limit: pagination.limit,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          }),
        ]);

        setSummary(summaryData);
        setLogs(historyData.logs);
        setPagination(historyData.pagination);
      } else {
        const statsData = await workspaceApi.getGenerationStats();
        setGenerationStats(statsData);
      }
    } catch (err) {
      setError(getErrorMessage(err, '加载统计数据失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination({ ...pagination, page: 1 });
    loadData();
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setPagination({ ...pagination, page: 1 });
    setTimeout(() => loadData(), 100);
  };

  const getReasonText = (reason: string) => {
    const reasonMap: Record<string, string> = {
      generation_hold: '生图扣费',
      admin_recharge: '管理员充值',
      generation_refund: '生图退款',
    };
    
    if (reason.includes('upscale')) return '图片放大';
    if (reason.includes('generation')) return '生图相关';
    
    return reasonMap[reason] || reason;
  };

  const maxDailyValue = summary?.dailyStats
    ? Math.max(...summary.dailyStats.map((s) => Math.max(s.spent, s.recharged)), 1)
    : 1;

  const maxGenDailyValue = generationStats?.dailyStats
    ? Math.max(...generationStats.dailyStats.map((s) => s.total), 1)
    : 1;

  return (
    <div className="list-stack">
      <div className="page-header">
        <div>
          <h1>数据中心</h1>
          <p>查看你的积分消费明细、生图统计和分析图表。</p>
        </div>
      </div>

      {/* Tab 切换 */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        borderBottom: '2px solid #e5e7eb',
        paddingBottom: '8px',
      }}>
        <button
          onClick={() => setActiveTab('credits')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'credits' ? '#3b82f6' : 'transparent',
            color: activeTab === 'credits' ? 'white' : '#6b7280',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: activeTab === 'credits' ? 'bold' : 'normal',
            transition: 'all 0.2s',
          }}
        >
          💰 消费统计
        </button>
        <button
          onClick={() => setActiveTab('generation')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'generation' ? '#3b82f6' : 'transparent',
            color: activeTab === 'generation' ? 'white' : '#6b7280',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: activeTab === 'generation' ? 'bold' : 'normal',
            transition: 'all 0.2s',
          }}
        >
          🎨 生图统计
        </button>
      </div>

      {error && <div className="error-text">{error}</div>}

      {loading ? (
        <div className="empty-card">加载中...</div>
      ) : activeTab === 'credits' ? (
        <>
          {/* 消费统计卡片 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}>
            <div style={{
              padding: '20px',
              background: '#fef3f2',
              borderRadius: '12px',
              border: '1px solid #fecaca',
            }}>
              <div style={{ fontSize: '14px', color: '#991b1b', marginBottom: '8px' }}>总消费</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#dc2626' }}>
                {summary?.totalSpent || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>积分</div>
            </div>

            <div style={{
              padding: '20px',
              background: '#ecfdf5',
              borderRadius: '12px',
              border: '1px solid #bbf7d0',
            }}>
              <div style={{ fontSize: '14px', color: '#166534', marginBottom: '8px' }}>总充值</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#16a34a' }}>
                {summary?.totalRecharged || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#22c55e', marginTop: '4px' }}>积分</div>
            </div>

            <div style={{
              padding: '20px',
              background: '#eff6ff',
              borderRadius: '12px',
              border: '1px solid #bfdbfe',
            }}>
              <div style={{ fontSize: '14px', color: '#1e40af', marginBottom: '8px' }}>记录数</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#2563eb' }}>
                {pagination.total}
              </div>
              <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '4px' }}>条</div>
            </div>
          </div>

          {/* 每日消费趋势 */}
          {summary && summary.dailyStats.length > 0 && (
            <div className="card" style={{ marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>每日消费趋势</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {summary.dailyStats.slice(-14).map((stat) => (
                  <div key={stat.date} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '100px', fontSize: '12px', color: '#6b7280', fontFamily: 'monospace' }}>
                      {stat.date}
                    </div>
                    <div style={{ flex: 1, display: 'flex', gap: '4px' }}>
                      {stat.spent > 0 && (
                        <div style={{
                          height: '24px',
                          width: `${(stat.spent / maxDailyValue) * 100}%`,
                          background: 'linear-gradient(90deg, #fee2e2 0%, #fecaca 100%)',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          paddingRight: '8px',
                          fontSize: '11px',
                          color: '#991b1b',
                          minWidth: '40px',
                        }}>
                          -{stat.spent}
                        </div>
                      )}
                      {stat.recharged > 0 && (
                        <div style={{
                          height: '24px',
                          width: `${(stat.recharged / maxDailyValue) * 100}%`,
                          background: 'linear-gradient(90deg, #d1fae5 0%, #bbf7d0 100%)',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          paddingRight: '8px',
                          fontSize: '11px',
                          color: '#166534',
                          minWidth: '40px',
                        }}>
                          +{stat.recharged}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 消费类型分布 */}
          {summary && Object.keys(summary.typeStats).length > 0 && (
            <div className="card" style={{ marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>消费类型分布</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {Object.entries(summary.typeStats).map(([type, amount]) => {
                  const total = Object.values(summary.typeStats).reduce((a, b) => a + b, 0);
                  const percentage = ((amount / total) * 100).toFixed(1);
                  return (
                    <div key={type} style={{
                      padding: '12px 16px',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                    }}>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{type}</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>
                        {amount} <span style={{ fontSize: '12px', color: '#9ca3af' }}>({percentage}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 筛选器 */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                  开始日期
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                  结束日期
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              </div>
              <button className="btn btn-primary" onClick={handleSearch}>查询</button>
              <button className="btn btn-secondary" onClick={handleClearFilters}>清除筛选</button>
            </div>
          </div>

          {/* 消费明细表格 */}
          <div className="card">
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>消费明细</h3>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>类型</th>
                    <th>积分变化</th>
                    <th>余额</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '13px', fontFamily: 'monospace' }}>
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td>
                        <span style={{
                          padding: '4px 8px',
                          background: log.delta < 0 ? '#fef3f2' : '#ecfdf5',
                          color: log.delta < 0 ? '#991b1b' : '#166534',
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}>
                          {getReasonText(log.reason)}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 'bold', color: log.delta < 0 ? '#dc2626' : '#16a34a' }}>
                          {log.delta < 0 ? '' : '+'}{log.delta}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>{log.balanceAfter}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {logs.length === 0 && <div className="empty-card" style={{ marginTop: '16px' }}>暂无消费记录</div>}

            {pagination.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '24px' }}>
                <button
                  className="btn btn-secondary"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                >
                  上一页
                </button>
                <span style={{ color: '#6b7280' }}>第 {pagination.page} / {pagination.totalPages} 页</span>
                <button
                  className="btn btn-secondary"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                >
                  下一页
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* 生图统计 */}
          {generationStats && (
            <>
              {/* 概览卡片 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
              }}>
                <div style={{ padding: '20px', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '14px', color: '#1e40af', marginBottom: '8px' }}>总任务数</div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#2563eb' }}>
                    {generationStats.overview.totalTasks}
                  </div>
                </div>
                <div style={{ padding: '20px', background: '#ecfdf5', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '14px', color: '#166534', marginBottom: '8px' }}>成功</div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#16a34a' }}>
                    {generationStats.overview.successTasks}
                  </div>
                </div>
                <div style={{ padding: '20px', background: '#fef3f2', borderRadius: '12px', border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '14px', color: '#991b1b', marginBottom: '8px' }}>失败</div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#dc2626' }}>
                    {generationStats.overview.failedTasks}
                  </div>
                </div>
                <div style={{ padding: '20px', background: '#fef3c7', borderRadius: '12px', border: '1px solid #fcd34d' }}>
                  <div style={{ fontSize: '14px', color: '#92400e', marginBottom: '8px' }}>成功率</div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#d97706' }}>
                    {generationStats.overview.successRate}%
                  </div>
                </div>
              </div>

              {/* 每日生图趋势 */}
              {generationStats.dailyStats.length > 0 && (
                <div className="card" style={{ marginBottom: '24px' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>每日生图趋势（最近30天）</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {generationStats.dailyStats.slice(-14).map((stat) => (
                      <div key={stat.date} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '100px', fontSize: '12px', color: '#6b7280', fontFamily: 'monospace' }}>
                          {stat.date}
                        </div>
                        <div style={{ flex: 1, display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <div style={{
                            height: '24px',
                            width: `${(stat.total / maxGenDailyValue) * 100}%`,
                            background: 'linear-gradient(90deg, #dbeafe 0%, #bfdbfe 100%)',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            paddingRight: '8px',
                            fontSize: '11px',
                            color: '#1e40af',
                            minWidth: '40px',
                          }}>
                            {stat.total}
                          </div>
                          <span style={{ fontSize: '11px', color: '#10b981' }}>✓{stat.success}</span>
                          {stat.failed > 0 && (
                            <span style={{ fontSize: '11px', color: '#ef4444' }}>✗{stat.failed}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 偏好分析 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {/* 模特偏好 */}
                <div className="card">
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>模特偏好</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>性别分布</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {Object.entries(generationStats.modelPreferences.gender).map(([key, value]) => (
                          <span key={key} style={{
                            padding: '4px 12px',
                            background: '#f3f4f6',
                            borderRadius: '12px',
                            fontSize: '12px',
                          }}>
                            {key}: {value}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>体型偏好</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {Object.entries(generationStats.modelPreferences.bodyType).map(([key, value]) => (
                          <span key={key} style={{
                            padding: '4px 12px',
                            background: '#f3f4f6',
                            borderRadius: '12px',
                            fontSize: '12px',
                          }}>
                            {key}: {value}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>常用姿势</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {Object.entries(generationStats.modelPreferences.pose).slice(0, 5).map(([key, value]) => (
                          <span key={key} style={{
                            padding: '4px 12px',
                            background: '#f3f4f6',
                            borderRadius: '12px',
                            fontSize: '12px',
                          }}>
                            {key}: {value}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 场景偏好 */}
                <div className="card">
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>场景偏好</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.entries(generationStats.scenePreferences.preset)
                      .sort((a, b) => b[1] - a[1])
                      .map(([preset, count]) => {
                        const total = Object.values(generationStats.scenePreferences.preset).reduce((a, b) => a + b, 0);
                        const percentage = ((count / total) * 100).toFixed(1);
                        return (
                          <div key={preset} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ flex: '0 0 100px', fontSize: '13px' }}>{preset}</div>
                            <div style={{ flex: 1, height: '24px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{
                                width: `${(count / total) * 100}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, #8b5cf6 0%, #a78bfa 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                paddingRight: '8px',
                                fontSize: '11px',
                                color: 'white',
                              }}>
                                {count} ({percentage}%)
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
