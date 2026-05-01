'use client'

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api/admin';
import { workspaceApi } from '@/lib/api/workspace';
import type { GenerationTask } from '@/lib/types';
import { getErrorMessage } from '@/lib/utils/api';
import { formatDateTime } from '@/lib/utils/format';
import { Image as ImageIcon, Download, ZoomIn, Maximize2, X, Loader2, Sparkles, Drama, Wand2 } from 'lucide-react';

export default function RecordsContent() {
  const [records, setRecords] = useState<GenerationTask[]>([]);
  const [error, setError] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [upscaleModal, setUpscaleModal] = useState<{ taskId: string; task: GenerationTask } | null>(null);
  const [upscaleLoading, setUpscaleLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    void adminApi
      .getRecords()
      .then(setRecords)
      .catch((loadError) => setError(getErrorMessage(loadError, '加载记录失败')))
      .finally(() => setInitialLoading(false));
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
      setRecords((prev) => prev.map((r) => (r.id === updatedTask.id ? updatedTask : r)));
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
      DESCRIBING_MODEL: '描述模特',
      DESCRIBING_SCENE: '描述场景',
      GENERATING: '生成中',
      COMPLETED: '已完成',
      FAILED: '失败',
    };
    return statusMap[status] || status;
  };

  const getStatusStyle = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'completed') return 'bg-green-100 text-green-700';
    if (s === 'failed') return 'bg-red-100 text-red-700';
    if (s === 'generating') return 'bg-pink-100 text-pink-800';
    if (s === 'pending') return 'bg-indigo-100 text-indigo-800';
    return 'bg-amber-100 text-amber-800';
  };

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="mb-1">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">生图记录</h1>
          </div>
          <p className="text-gray-500 text-sm ml-[52px]">查看所有客户的任务状态、积分消耗与结果图。</p>
        </div>

        {error ? (
          <div className="bg-[rgba(196,112,112,0.08)] text-red-600 px-4 py-3 rounded-2xl text-sm font-medium border border-red-100">{error}</div>
        ) : null}
        
        <div className="overflow-x-auto fashion-glass rounded-2xl">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">客户邮箱</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">类型</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">任务ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">参考图</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">状态</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">积分</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">创建时间</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const typeMap: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
                  'workspace': { label: '工作台', icon: <Sparkles className="w-3 h-3" />, cls: 'bg-[var(--bg-active)] text-[#c67b5c]' },
                  'model-fusion': { label: '模特合成', icon: <Drama className="w-3 h-3" />, cls: 'bg-[var(--bg-active)] text-[var(--text-secondary)]' },
                  'redesign': { label: 'AI改款', icon: <Wand2 className="w-3 h-3" />, cls: 'bg-[rgba(176,101,74,0.08)] text-[#b0654a]' },
                }
                const tc = typeMap[record.type] || typeMap['workspace']
                const resultImages = (record.resultUrls && record.resultUrls.length > 0) ? record.resultUrls : (record.resultUrl ? [record.resultUrl] : [])
                const refImages: { url: string; label: string }[] = []
                if (record.clothingUrl) refImages.push({ url: record.clothingUrl, label: '服装' })
                if (record.type === 'model-fusion') {
                  const mUrls = (record.modelConfig as any)?.modelUrls as string[] | undefined
                  if (mUrls) mUrls.forEach((u, i) => refImages.push({ url: u, label: `模特${i+1}` }))
                } else {
                  if (record.modelConfig?.imageUrl) refImages.push({ url: record.modelConfig.imageUrl, label: '模特' })
                }
                if (record.sceneConfig?.imageUrl) refImages.push({ url: record.sceneConfig.imageUrl, label: '场景' })

                return (
                <tr key={record.id} className="hover:bg-blue-500/[0.03] transition-colors">
                  <td className="px-4 py-3 border-b border-gray-100">
                    <div className="font-medium text-gray-800 text-xs">{record.user?.email ?? '-'}</div>
                  </td>
                  <td className="px-4 py-3 border-b border-gray-100">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${tc.cls}`}>
                      {tc.icon} {tc.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 border-b border-gray-100">
                    <span className="inline-block px-2 py-0.5 bg-slate-100 rounded-md font-mono text-[11px] text-slate-600">{record.id.slice(0, 8)}</span>
                  </td>
                  <td className="px-4 py-3 border-b border-gray-100">
                    <div className="flex gap-1">
                      {refImages.slice(0, 3).map((img, i) => (
                        <img key={i} src={img.url} alt={img.label} onClick={() => setPreviewImage(img.url)} className="w-10 h-10 object-cover rounded-2xl cursor-pointer border border-gray-200 hover:ring-2 hover:ring-blue-300 transition-all" title={img.label} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 border-b border-gray-100">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${getStatusStyle(record.status)}`}>
                      {getStatusText(record.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 border-b border-gray-100 text-gray-700 text-xs">{record.creditCost}</td>
                  <td className="px-4 py-3 border-b border-gray-100 text-gray-500 text-[11px]">{formatDateTime(record.createdAt)}</td>
                  <td className="px-4 py-3 border-b border-gray-100">
                    <div className="flex gap-1.5 items-center flex-wrap">
                      {resultImages.slice(0, 4).map((url, i) => (
                        <img key={i} src={url} alt={`结果${i+1}`} onClick={() => setPreviewImage(url)} className="w-10 h-10 object-cover rounded-2xl cursor-pointer border border-gray-200 hover:ring-2 hover:ring-blue-300 transition-all" />
                      ))}
                      {resultImages.length > 4 && <span className="text-[10px] text-gray-400">+{resultImages.length - 4}</span>}
                      {resultImages.length > 0 && (
                        <button className="inline-flex items-center gap-0.5 px-2 py-1 bg-white/70 text-gray-700 border border-black/10 rounded-2xl text-[10px] font-medium hover:bg-white/90 transition-all" onClick={() => handleDownload(resultImages[0], record.id)}>
                          <Download className="w-2.5 h-2.5" /> 下载
                        </button>
                      )}
                      {record.upscaledUrl && (
                        <img src={record.upscaledUrl} alt={`放大${record.upscaleFactor}x`} onClick={() => setPreviewImage(record.upscaledUrl!)} className="w-10 h-10 object-cover rounded-2xl cursor-pointer border-2 border-green-400" title={`已放大${record.upscaleFactor}x`} />
                      )}
                      {record.status === 'FAILED' && (
                        <span className="text-red-500 text-[10px]">{record.errorMsg || '未知错误'}</span>
                      )}
                      {!resultImages.length && record.status !== 'FAILED' && (
                        <span className="text-gray-400 text-[10px]">处理中</span>
                      )}
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {initialLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 bg-white/40 rounded-2xl border border-dashed border-black/[0.08]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载中...
          </div>
        ) : records.length === 0 && !error ? (
          <div className="text-center py-10 px-6 text-gray-400 text-sm bg-white/40 rounded-2xl border border-dashed border-black/[0.08]">
            暂无生图记录
          </div>
        ) : null}
      </div>

      {previewImage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-6" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-[90vw] max-h-[90vh] bg-white/85 backdrop-blur-[40px] rounded-3xl border border-white/80 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <button className="absolute top-3 right-3 w-8 h-8 bg-black/50 text-white border-none rounded-full flex items-center justify-center text-sm cursor-pointer z-10 hover:bg-black/70 transition-colors" onClick={() => setPreviewImage(null)}>
              <X className="w-4 h-4" />
            </button>
            <img src={previewImage} alt="预览" className="max-w-full max-h-[85vh] object-contain" />
          </div>
        </div>
      )}

      {upscaleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-6" onClick={() => !upscaleLoading && setUpscaleModal(null)}>
          <div className="relative max-w-[480px] w-full bg-white/85 backdrop-blur-[40px] rounded-3xl border border-white/80 shadow-2xl p-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">高清放大</h3>
            <p className="text-gray-500 text-sm mb-6">
              选择放大倍数，提升图片分辨率和清晰度
            </p>
            <div className="flex gap-4 mb-6">
              <button
                className="flex-1 p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl cursor-pointer transition-all disabled:cursor-not-allowed disabled:bg-gray-100"
                onClick={() => handleUpscale(2)}
                disabled={upscaleLoading}
              >
                <div className="text-2xl font-bold text-gray-800 mb-2">2x</div>
                <div className="text-xs text-gray-500">消耗 1 积分</div>
              </button>
            </div>
            {upscaleLoading && (
              <div className="text-center p-4 bg-gray-50 rounded-2xl">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin mx-auto mb-2" />
                <div className="text-sm text-gray-500">正在放大图片...</div>
              </div>
            )}
            <button
              className="w-full mt-4 inline-flex items-center justify-center px-5 py-2.5 bg-white/70 text-gray-700 border border-black/10 rounded-2xl text-sm font-medium backdrop-blur-sm hover:bg-white/90 transition-all disabled:opacity-50"
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
