import { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin';
import { workspaceApi } from '../../api/workspace';
import type { GenerationTask } from '../../types';
import { getErrorMessage } from '../../utils/api';
import { formatDateTime } from '../../utils/format';

export default function AdminRecordsPage() {
  const [records, setRecords] = useState<GenerationTask[]>([]);
  const [error, setError] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [upscaleModal, setUpscaleModal] = useState<{ taskId: string; task: GenerationTask } | null>(null);
  const [upscaleLoading, setUpscaleLoading] = useState(false);

  useEffect(() => {
    void adminApi
      .getRecords()
      .then(setRecords)
      .catch((loadError) => setError(getErrorMessage(loadError, '加载记录失败')));
  }, []);

  const handleDownload = async (url: string, taskId: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `task-${taskId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('下载失败', err);
      alert('下载失败，请重试');
    }
  };

  const handleUpscale = async (factor: number) => {
    if (!upscaleModal) return;
    
    setUpscaleLoading(true);
    try {
      const updatedTask = await workspaceApi.upscaleTask(upscaleModal.taskId, factor);
      setRecords(records.map((r) => (r.id === updatedTask.id ? updatedTask : r)));
      setUpscaleModal(null);
    } catch (err) {
      console.error('放大失败', err);
      alert(getErrorMessage(err, '放大失败，请重试'));
    } finally {
      setUpscaleLoading(false);
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      PENDING: '等待中',
      PROCESSING: '处理中',
      DONE: '已完成',
      FAILED: '失败',
    };
    return statusMap[status] || status;
  };

  return (
    <>
      <div className="list-stack">
        <div className="page-header">
          <div>
            <h1>生图记录</h1>
            <p>查看所有客户的任务状态、积分消耗与结果图。</p>
          </div>
        </div>
        {error ? <div className="error-text">{error}</div> : null}
        
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>客户邮箱</th>
                <th>任务ID</th>
                <th>参考图</th>
                <th>状态</th>
                <th>积分</th>
                <th>创建时间</th>
                <th>完成时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{record.user?.email ?? '-'}</div>
                  </td>
                  <td>
                    <span className="code-chip">{record.id.slice(0, 8)}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {record.clothingUrl && (
                        <img
                          src={record.clothingUrl}
                          alt="服装"
                          onClick={() => setPreviewImage(record.clothingUrl)}
                          style={{
                            width: 48,
                            height: 48,
                            objectFit: 'cover',
                            borderRadius: 6,
                            cursor: 'pointer',
                            border: '1px solid #e5e7eb',
                          }}
                        />
                      )}
                      {record.modelConfig?.imageUrl && (
                        <img
                          src={record.modelConfig.imageUrl}
                          alt="模特"
                          onClick={() => setPreviewImage(record.modelConfig.imageUrl)}
                          style={{
                            width: 48,
                            height: 48,
                            objectFit: 'cover',
                            borderRadius: 6,
                            cursor: 'pointer',
                            border: '1px solid #e5e7eb',
                          }}
                        />
                      )}
                      {record.sceneConfig?.imageUrl && (
                        <img
                          src={record.sceneConfig.imageUrl}
                          alt="场景"
                          onClick={() => setPreviewImage(record.sceneConfig.imageUrl ?? null)}
                          style={{
                            width: 48,
                            height: 48,
                            objectFit: 'cover',
                            borderRadius: 6,
                            cursor: 'pointer',
                            border: '1px solid #e5e7eb',
                          }}
                        />
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`status-pill status-${record.status.toLowerCase()}`}>
                      {getStatusText(record.status)}
                    </span>
                  </td>
                  <td>{record.creditCost}</td>
                  <td>{formatDateTime(record.createdAt)}</td>
                  <td>{formatDateTime(record.finishedAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {record.resultUrl && (
                        <>
                          <img
                            src={record.resultUrl}
                            alt="结果"
                            onClick={() => setPreviewImage(record.resultUrl!)}
                            style={{
                              width: 48,
                              height: 48,
                              objectFit: 'cover',
                              borderRadius: 6,
                              cursor: 'pointer',
                              border: '1px solid #e5e7eb',
                            }}
                          />
                          <button
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={() => handleDownload(record.resultUrl!, record.id)}
                          >
                            下载
                          </button>
                          {record.status === 'DONE' && !record.upscaledUrl && (
                            <button
                              className="btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '12px', background: '#d1fae5', borderColor: '#10b981' }}
                              onClick={() => setUpscaleModal({ taskId: record.id, task: record })}
                            >
                              放大
                            </button>
                          )}
                        </>
                      )}
                      {record.upscaledUrl && (
                        <>
                          <img
                            src={record.upscaledUrl}
                            alt={`放大 ${record.upscaleFactor}x`}
                            onClick={() => setPreviewImage(record.upscaledUrl!)}
                            style={{
                              width: 48,
                              height: 48,
                              objectFit: 'cover',
                              borderRadius: 6,
                              cursor: 'pointer',
                              border: '1px solid #10b981',
                            }}
                            title={`已放大 ${record.upscaleFactor}x`}
                          />
                          <button
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={() => handleDownload(record.upscaledUrl!, record.id)}
                          >
                            下载{record.upscaleFactor}x
                          </button>
                        </>
                      )}
                      {record.status === 'FAILED' && (
                        <span style={{ color: '#ef4444', fontSize: '12px' }}>
                          {record.errorMsg || '未知错误'}
                        </span>
                      )}
                      {!record.resultUrl && record.status !== 'FAILED' && (
                        <span style={{ color: '#9ca3af', fontSize: '12px' }}>处理中</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {records.length === 0 && !error && (
          <div className="empty-card">暂无生图记录</div>
        )}
      </div>

      {previewImage && (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPreviewImage(null)}>
              ✕
            </button>
            <img src={previewImage} alt="预览" />
          </div>
        </div>
      )}
      {upscaleModal && (
        <div className="modal-overlay" onClick={() => !upscaleLoading && setUpscaleModal(null)}>
          <div className="modal-content" style={{ maxWidth: '480px', padding: '32px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600' }}>高清放大</h3>
            <p style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: '14px' }}>
              选择放大倍数，提升图片分辨率和清晰度
            </p>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
              <button
                className="btn btn-secondary"
                style={{ 
                  flex: 1, 
                  padding: '16px',
                  background: upscaleLoading ? '#f3f4f6' : '#f9fafb',
                  cursor: upscaleLoading ? 'not-allowed' : 'pointer'
                }}
                onClick={() => handleUpscale(2)}
                disabled={upscaleLoading}
              >
                <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>2x</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>消耗 5 积分</div>
              </button>
              <button
                className="btn btn-secondary"
                style={{ 
                  flex: 1, 
                  padding: '16px',
                  background: upscaleLoading ? '#f3f4f6' : '#f9fafb',
                  cursor: upscaleLoading ? 'not-allowed' : 'pointer'
                }}
                onClick={() => handleUpscale(4)}
                disabled={upscaleLoading}
              >
                <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>4x</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>消耗 5 积分</div>
              </button>
            </div>
            {upscaleLoading && (
              <div style={{ textAlign: 'center', padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
                <div style={{ marginBottom: '8px', fontSize: '14px', color: '#6b7280' }}>正在放大图片...</div>
                <div className="spinner" style={{ margin: '0 auto' }}></div>
              </div>
            )}
            <button
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: '16px' }}
              onClick={() => setUpscaleModal(null)}
              disabled={upscaleLoading}
            >
              取消
            </button>
          </div>
        </div>
      )}
    </>
  );
}
