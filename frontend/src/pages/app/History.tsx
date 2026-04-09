import { useEffect, useState } from 'react';
import { workspaceApi } from '../../api/workspace';
import { LazyImage } from '../../components/LazyImage';
import type { GenerationTask } from '../../types';
import { getErrorMessage } from '../../utils/api';
import { formatDateTime } from '../../utils/format';

export default function HistoryPage() {
  const [records, setRecords] = useState<GenerationTask[]>([]);
  const [error, setError] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [upscaleModal, setUpscaleModal] = useState<{ taskId: string; task: GenerationTask } | null>(null);
  const [upscaleLoading, setUpscaleLoading] = useState(false);

  useEffect(() => {
    void workspaceApi
      .getRecords()
      .then(setRecords)
      .catch((loadError) => setError(getErrorMessage(loadError, '加载历史记录失败')));
  }, []);

  const handleDownload = async (url: string, taskId: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `fashion-ai-${taskId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('下载失败', err);
      alert('下载失败，请重试');
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!window.confirm('确定要删除这条记录吗？删除后无法恢复。')) {
      return;
    }
    try {
      await workspaceApi.deleteTask(taskId);
      setRecords(records.filter((r) => r.id !== taskId));
    } catch (err) {
      console.error('删除失败', err);
      alert('删除失败，请重试');
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

  const _updateTask = (taskId: string, updates: Partial<GenerationTask>) => {
    setRecords(records.map((r) => (r.id === taskId ? { ...r, ...updates } : r)));
  };
  void _updateTask;

  return (
    <>
      <div className="list-stack">
        <div className="page-header">
          <div>
            <h1>历史记录</h1>
            <p>查看你的所有生图任务、状态与结果图片。</p>
          </div>
        </div>
        {error ? <div className="error-text">{error}</div> : null}
        {records.length === 0 ? (
          <div className="empty-card">还没有历史记录，先去工作台创建第一张图吧。</div>
        ) : (
          <div className="list-stack">
            {records.map((record) => (
              <article key={record.id} className="record-card">
                <div className="inline-actions" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <span className={`status-pill status-${record.status.toLowerCase()}`}>{record.status}</span>
                    <span style={{ marginLeft: '12px' }}>{formatDateTime(record.createdAt)}</span>
                  </div>
                  <button
                    className="btn btn-danger"
                    style={{ padding: '6px 16px', fontSize: '14px' }}
                    onClick={() => handleDelete(record.id)}
                  >
                    删除
                  </button>
                </div>
                <div className="record-grid">
                  <div>
                    <div className="muted-label">任务 ID</div>
                    <div className="code-chip">{record.id}</div>
                  </div>
                  <div>
                    <div className="muted-label">积分消耗</div>
                    <div>{record.creditCost}</div>
                  </div>
                  <div>
                    <div className="muted-label">完成时间</div>
                    <div>{formatDateTime(record.finishedAt)}</div>
                  </div>
                </div>
                {record.clothingUrl ? (
                  <div>
                    <div className="muted-label">参考图片</div>
                    <div className="image-row">
                      <div className="image-item">
                        <LazyImage
                          src={record.clothingUrl}
                          alt="服装参考图"
                          onClick={() => setPreviewImage(record.clothingUrl)}
                        />
                        <div className="image-overlay">
                          <button className="icon-btn" onClick={() => setPreviewImage(record.clothingUrl)} title="放大">
                            🔍
                          </button>
                          <button className="icon-btn" onClick={() => handleDownload(record.clothingUrl, record.id)} title="下载">
                            ⬇️
                          </button>
                        </div>
                      </div>
                      {record.modelConfig?.imageUrl && (
                        <div className="image-item">
                          <LazyImage
                            src={record.modelConfig.imageUrl}
                            alt="模特参考图"
                            onClick={() => setPreviewImage(record.modelConfig.imageUrl ?? null)}
                          />
                          <div className="image-overlay">
                            <button className="icon-btn" onClick={() => setPreviewImage(record.modelConfig.imageUrl ?? null)} title="放大">
                              🔍
                            </button>
                            <button className="icon-btn" onClick={() => handleDownload(record.modelConfig.imageUrl!, record.id)} title="下载">
                              ⬇️
                            </button>
                          </div>
                        </div>
                      )}
                      {record.sceneConfig?.imageUrl && (
                        <div className="image-item">
                          <LazyImage
                            src={record.sceneConfig.imageUrl}
                            alt="场景参考图"
                            onClick={() => setPreviewImage(record.sceneConfig.imageUrl)}
                          />
                          <div className="image-overlay">
                            <button className="icon-btn" onClick={() => setPreviewImage(record.sceneConfig.imageUrl)} title="放大">
                              🔍
                            </button>
                            <button className="icon-btn" onClick={() => handleDownload(record.sceneConfig.imageUrl!, record.id)} title="下载">
                              ⬇️
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
                {record.resultUrl ? (
                  <div>
                    <div className="muted-label">生成结果</div>
                    <div className="image-row">
                      <div className="image-item">
                        <LazyImage
                          src={record.resultUrl}
                          alt="历史结果图"
                          onClick={() => setPreviewImage(record.resultUrl!)}
                        />
                        <div className="image-overlay">
                          <button className="icon-btn" onClick={() => setPreviewImage(record.resultUrl!)} title="预览">
                            🔍
                          </button>
                          <button className="icon-btn" onClick={() => handleDownload(record.resultUrl!, record.id)} title="下载">
                            ⬇️
                          </button>
                          {record.status === 'DONE' && !record.upscaledUrl && (
                            <button 
                              className="icon-btn" 
                              onClick={() => setUpscaleModal({ taskId: record.id, task: record })} 
                              title="高清放大"
                              style={{ background: '#10b981' }}
                            >
                              ⬆️
                            </button>
                          )}
                        </div>
                      </div>
                      {record.upscaledUrl && (
                        <div className="image-item">
                          <LazyImage
                            src={record.upscaledUrl}
                            alt={`放大 ${record.upscaleFactor}x 结果`}
                            onClick={() => setPreviewImage(record.upscaledUrl!)}
                          />
                          <div className="image-overlay">
                            <div style={{ 
                              position: 'absolute', 
                              top: '8px', 
                              left: '8px', 
                              background: '#10b981', 
                              color: 'white', 
                              padding: '4px 8px', 
                              borderRadius: '4px', 
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}>
                              {record.upscaleFactor}x
                            </div>
                            <button className="icon-btn" onClick={() => setPreviewImage(record.upscaledUrl!)} title="预览">
                              🔍
                            </button>
                            <button className="icon-btn" onClick={() => handleDownload(record.upscaledUrl!, record.id)} title="下载">
                              ⬇️
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
                {record.errorMsg ? <div className="error-text">失败原因：{record.errorMsg}</div> : null}
              </article>
            ))}
          </div>
        )}
      </div>
      {previewImage && (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPreviewImage(null)}>✕</button>
            <img src={previewImage} alt="预览图片" />
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
