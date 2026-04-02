import { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin';
import { getErrorMessage } from '../../utils/api';

export default function KeywordsStatsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<{
    topKeywords: Array<{ keyword: string; count: number; type: string }>;
    typeGroups: Record<string, Array<{ keyword: string; count: number }>>;
    weeklyTrends: Array<{ week: string; keywords: Record<string, number> }>;
    totalTasks: number;
  } | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await adminApi.getKeywordsStats({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: 100,
      });
      setData(result);
    } catch (err) {
      setError(getErrorMessage(err, '加载关键词统计失败'));
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

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      gender: '#ec4899',
      skinTone: '#f59e0b',
      bodyType: '#10b981',
      pose: '#3b82f6',
      expression: '#8b5cf6',
      scene: '#06b6d4',
      prompt: '#6366f1',
      clothing: '#84cc16',
    };
    return colors[type] || '#6b7280';
  };

  const getFontSize = (count: number, maxCount: number) => {
    const minSize = 12;
    const maxSize = 32;
    const ratio = count / maxCount;
    return Math.floor(minSize + (maxSize - minSize) * ratio);
  };

  const maxCount = data?.topKeywords[0]?.count || 1;

  return (
    <div className="list-stack">
      <div className="page-header">
        <div>
          <h1>热门关键词分析</h1>
          <p>分析用户生图偏好和热门关键词趋势，总任务数：{data?.totalTasks || 0}</p>
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
          {/* 词云图 */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>关键词词云</h3>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '20px',
              background: '#fafafa',
              borderRadius: '8px',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '300px',
            }}>
              {data?.topKeywords.slice(0, 80).map((item) => (
                <div
                  key={item.keyword}
                  style={{
                    fontSize: `${getFontSize(item.count, maxCount)}px`,
                    color: getTypeColor(item.type),
                    fontWeight: item.count > maxCount * 0.5 ? 'bold' : 'normal',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  title={`${item.keyword}: ${item.count} 次`}
                >
                  {item.keyword.split(':')[1] || item.keyword}
                </div>
              ))}
            </div>
          </div>

          {/* 分类统计 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {data?.typeGroups && Object.entries(data.typeGroups).map(([type, keywords]) => (
              <div key={type} className="card">
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: getTypeColor(type) }}>
                  {type === 'gender' ? '性别偏好' :
                   type === 'skinTone' ? '肤色偏好' :
                   type === 'bodyType' ? '体型偏好' :
                   type === 'pose' ? '姿势偏好' :
                   type === 'expression' ? '表情偏好' :
                   type === 'scene' ? '场景偏好' :
                   type === 'prompt' ? '提示词关键词' :
                   type === 'clothing' ? '服装关键词' : type}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {keywords.slice(0, 10).map((kw) => {
                    const total = keywords.reduce((sum, k) => sum + k.count, 0);
                    const percentage = ((kw.count / total) * 100).toFixed(1);
                    return (
                      <div key={kw.keyword} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: '0 0 100px', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {kw.keyword.split(':')[1] || kw.keyword}
                        </div>
                        <div style={{ flex: 1, height: '20px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${(kw.count / keywords[0].count) * 100}%`,
                            height: '100%',
                            background: getTypeColor(type),
                            transition: 'width 0.3s',
                          }} />
                        </div>
                        <div style={{ fontSize: '11px', color: '#6b7280', width: '60px', textAlign: 'right' }}>
                          {kw.count} ({percentage}%)
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* 周趋势 */}
          {data?.weeklyTrends && data.weeklyTrends.length > 0 && (
            <div className="card">
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>场景偏好周趋势</h3>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>周起始日</th>
                      <th>热门场景 Top 5</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.weeklyTrends.slice(-8).map((week) => (
                      <tr key={week.week}>
                        <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{week.week}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {Object.entries(week.keywords)
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 5)
                              .map(([keyword, count]) => (
                                <span key={keyword} style={{
                                  padding: '4px 12px',
                                  background: '#f3f4f6',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                }}>
                                  {keyword}: {count}
                                </span>
                              ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
