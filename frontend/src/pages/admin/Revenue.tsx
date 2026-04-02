import { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin';
import { getErrorMessage } from '../../utils/api';

export default function RevenuePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<{
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
  } | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await adminApi.getRevenueStats({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setData(result);
    } catch (err) {
      setError(getErrorMessage(err, '加载营收统计失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadData();
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setTimeout(() => loadData(), 100);
  };

  const maxDailyRevenue = data?.dailyRevenue
    ? Math.max(...data.dailyRevenue.map((d) => d.revenue), 1)
    : 1;

  const maxMonthlyRevenue = data?.monthlyRevenue
    ? Math.max(...data.monthlyRevenue.map((m) => m.revenue), 1)
    : 1;

  return (
    <div className="list-stack">
      <div className="page-header">
        <div>
          <h1>营收报表</h1>
          <p>查看系统营收数据、用户消费分析和趋势图表。</p>
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}

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

      {loading ? (
        <div className="empty-card">加载中...</div>
      ) : (
        <>
          {/* 总览卡片 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}>
            <div style={{
              padding: '20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '12px',
              color: 'white',
            }}>
              <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>总营收（积分）</div>
              <div style={{ fontSize: '36px', fontWeight: 'bold' }}>
                {data?.totalRevenue.toLocaleString() || 0}
              </div>
            </div>

            <div style={{
              padding: '20px',
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              borderRadius: '12px',
              color: 'white',
            }}>
              <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>交易笔数</div>
              <div style={{ fontSize: '36px', fontWeight: 'bold' }}>
                {data?.transactionCount.toLocaleString() || 0}
              </div>
            </div>

            <div style={{
              padding: '20px',
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              borderRadius: '12px',
              color: 'white',
            }}>
              <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>新客户贡献</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                {data?.customerAnalysis.newCustomerRevenue.toLocaleString() || 0}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '4px' }}>
                占比 {data?.customerAnalysis.newCustomerPercentage}%
              </div>
            </div>

            <div style={{
              padding: '20px',
              background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
              borderRadius: '12px',
              color: 'white',
            }}>
              <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>老客户贡献</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                {data?.customerAnalysis.oldCustomerRevenue.toLocaleString() || 0}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '4px' }}>
                占比 {(100 - parseFloat(data?.customerAnalysis.newCustomerPercentage || '0')).toFixed(1)}%
              </div>
            </div>
          </div>

          {/* 每日营收趋势 */}
          {data?.dailyRevenue && data.dailyRevenue.length > 0 && (
            <div className="card" style={{ marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>每日营收趋势</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {data.dailyRevenue.slice(-14).map((item) => (
                  <div key={item.date} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '100px', fontSize: '12px', color: '#6b7280', fontFamily: 'monospace' }}>
                      {item.date}
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        height: '24px',
                        width: `${(item.revenue / maxDailyRevenue) * 100}%`,
                        background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '4px',
                        minWidth: '40px',
                        transition: 'width 0.3s',
                      }} />
                      <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 'bold' }}>
                        {item.revenue}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 月度营收 */}
          {data?.monthlyRevenue && data.monthlyRevenue.length > 0 && (
            <div className="card" style={{ marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>月度营收统计</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data.monthlyRevenue.map((item) => (
                  <div key={item.month} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '80px', fontSize: '13px', fontWeight: 'bold', color: '#374151' }}>
                      {item.month}
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        height: '32px',
                        width: `${(item.revenue / maxMonthlyRevenue) * 100}%`,
                        background: 'linear-gradient(90deg, #f093fb 0%, #f5576c 100%)',
                        borderRadius: '4px',
                        minWidth: '60px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        paddingRight: '12px',
                        fontSize: '12px',
                        color: 'white',
                        fontWeight: 'bold',
                        transition: 'width 0.3s',
                      }}>
                        {item.revenue}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 营收类型分布和Top用户 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {/* 营收类型分布 */}
            <div className="card">
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>营收类型分布</h3>
              {data?.revenueByType && Object.keys(data.revenueByType).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {Object.entries(data.revenueByType)
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, revenue]) => {
                      const total = Object.values(data.revenueByType).reduce((a, b) => a + b, 0);
                      const percentage = ((revenue / total) * 100).toFixed(1);
                      return (
                        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ flex: '0 0 100px', fontSize: '13px', fontWeight: '500' }}>
                            {type === 'generation' ? '生图' : type === 'upscale' ? '放大' : type}
                          </div>
                          <div style={{ flex: 1, height: '24px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${(revenue / Math.max(...Object.values(data.revenueByType))) * 100}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #43e97b 0%, #38f9d7 100%)',
                              transition: 'width 0.3s',
                            }} />
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280', width: '80px', textAlign: 'right' }}>
                            {revenue} ({percentage}%)
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="empty-card">暂无数据</div>
              )}
            </div>

            {/* Top 消费用户 */}
            <div className="card">
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>Top 10 消费用户</h3>
              {data?.topUsers && data.topUsers.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {data.topUsers.map((user, index) => (
                    <div key={user.userId} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 12px',
                      background: index < 3 ? '#fef3c7' : '#f9fafb',
                      borderRadius: '6px',
                    }}>
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: index < 3 ? '#f59e0b' : '#d1d5db',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold',
                      }}>
                        {index + 1}
                      </div>
                      <div style={{ flex: 1, fontSize: '13px' }}>
                        {user.email}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#dc2626' }}>
                        {user.revenue.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-card">暂无数据</div>
              )}
            </div>
          </div>

          {/* 新老客户占比可视化 */}
          <div className="card">
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>新老客户贡献对比</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div style={{
                width: '200px',
                height: '200px',
                borderRadius: '50%',
                background: `conic-gradient(
                  #4facfe 0% ${data?.customerAnalysis.newCustomerPercentage}%,
                  #43e97b ${data?.customerAnalysis.newCustomerPercentage}% 100%
                )`,
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  background: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                    {data?.totalRevenue.toLocaleString() || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>总营收</div>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#4facfe' }} />
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>新客户（30天内首次使用）</span>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#4facfe' }}>
                    {data?.customerAnalysis.newCustomerRevenue.toLocaleString() || 0} 积分
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    占比 {data?.customerAnalysis.newCustomerPercentage}%
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#43e97b' }} />
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>老客户</span>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#43e97b' }}>
                    {data?.customerAnalysis.oldCustomerRevenue.toLocaleString() || 0} 积分
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    占比 {(100 - parseFloat(data?.customerAnalysis.newCustomerPercentage || '0')).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
