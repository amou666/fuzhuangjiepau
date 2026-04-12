'use client'

import { useEffect, useState } from 'react';
import { workspaceApi } from '@/lib/api/workspace';
import { LazyImage } from '@/lib/components/LazyImage';
import { useAuthStore } from '@/lib/stores/authStore';
import type { GenerationTask } from '@/lib/types';
import { getErrorMessage } from '@/lib/utils/api';
import { formatDateTime } from '@/lib/utils/format';
import { Clock, Trash2, ZoomIn, Download, Maximize2, Loader2, X, Image, Coins, Hash, CalendarCheck, Drama, Wand2, Sparkles } from 'lucide-react';

const TYPE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  'workspace': { label: '工作台', icon: Sparkles, color: 'text-[#c67b5c]', bg: 'bg-[rgba(198,123,92,0.08)]' },
  'model-fusion': { label: '模特合成', icon: Drama, color: 'text-[#8b7355]', bg: 'bg-[rgba(139,115,85,0.08)]' },
  'redesign': { label: 'AI改款', icon: Wand2, color: 'text-[#b0654a]', bg: 'bg-[rgba(176,101,74,0.08)]' },
}

export default function HistoryPage() {
  const updateCredits = useAuthStore((state) => state.updateCredits);
  const [records, setRecords] = useState<GenerationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number } | null>(null);
  const [upscaleModal, setUpscaleModal] = useState<{ taskId: string; imageUrl: string } | null>(null);
  const [upscaleLoading, setUpscaleLoading] = useState(false);
  const [upscalingTaskIds, setUpscalingTaskIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    void workspaceApi
      .getRecords()
      .then(setRecords)
      .catch((loadError) => setError(getErrorMessage(loadError, '加载历史记录失败')))
      .finally(() => setLoading(false));
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
    const { taskId, imageUrl } = upscaleModal;
    
    setUpscaleLoading(true);
    setUpscalingTaskIds(prev => new Set(prev).add(taskId));
    setUpscaleModal(null);

    // 立即刷新积分（后端已扣除）
    try { updateCredits(await workspaceApi.getBalance()); } catch {}

    // 记录放大发起时间，用于判断放大是否完成（upscaledUrl 有值且在放大之后更新）
    const upscaleStartTime = Date.now();

    try {
      await workspaceApi.upscaleTask(taskId, factor, imageUrl);
      let polled = false;
      const pollInterval = setInterval(async () => {
        try {
          const task = await workspaceApi.getTask(taskId);
          // 放大成功：upscaledUrl 有值
          if (task.upscaledUrl) {
            setRecords(prev => prev.map(r => r.id === taskId ? task : r));
            setUpscalingTaskIds(prev => {
              const next = new Set(prev);
              next.delete(taskId);
              return next;
            });
            clearInterval(pollInterval);
            polled = true;
            // 放大完成后刷新积分（失败会退款）
            try { updateCredits(await workspaceApi.getBalance()); } catch {}
          }
          // 放大失败：有错误信息且超时一段时间（给后端处理时间）
          if (task.errorMsg && (Date.now() - upscaleStartTime > 10000)) {
            setUpscalingTaskIds(prev => {
              const next = new Set(prev);
              next.delete(taskId);
              return next;
            });
            clearInterval(pollInterval);
            polled = true;
            // 失败会退款，刷新积分
            try { updateCredits(await workspaceApi.getBalance()); } catch {}
            alert(task.errorMsg || '放大失败，请重试');
          }
        } catch {
          // polling error continue
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(pollInterval);
        if (!polled) {
          setUpscalingTaskIds(prev => {
            const next = new Set(prev);
            next.delete(taskId);
            return next;
          });
          // 超时也刷新积分
          workspaceApi.getBalance().then(updateCredits).catch(() => {});
          alert('放大超时，请稍后在历史记录中查看结果');
        }
      }, 120000);
    } catch (err) {
      console.error('放大失败', err);
      setUpscalingTaskIds(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      // 请求失败也刷新积分
      workspaceApi.getBalance().then(updateCredits).catch(() => {});
      alert(getErrorMessage(err, '放大失败，请重试'));
    } finally {
      setUpscaleLoading(false);
    }
  };

  const getStatusStyle = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'completed' || s === 'done') return 'bg-green-100 text-green-700';
    if (s === 'failed') return 'bg-red-100 text-red-700';
    if (s === 'generating') return 'bg-pink-100 text-pink-800';
    if (s === 'pending') return 'bg-indigo-100 text-indigo-800';
    return 'bg-amber-100 text-amber-800';
  };

  // 收集所有要展示的结果图（优先 resultUrls，回退 resultUrl）
  const getResultImages = (record: GenerationTask): string[] => {
    if (record.resultUrls && record.resultUrls.length > 0) return record.resultUrls
    if (record.resultUrl) return [record.resultUrl]
    return []
  }

  // 收集所有参考图
  const getRefImages = (record: GenerationTask): { url: string; label: string }[] => {
    const imgs: { url: string; label: string }[] = []
    if (record.clothingUrl) imgs.push({ url: record.clothingUrl, label: '服装' })
    if (record.type === 'model-fusion') {
      // model-fusion 的 modelUrls 存在 modelConfig 中
      const modelUrls = (record.modelConfig as any)?.modelUrls as string[] | undefined
      if (modelUrls) {
        modelUrls.forEach((u, i) => imgs.push({ url: u, label: `模特${i + 1}` }))
      }
    } else {
      if (record.modelConfig?.imageUrl) imgs.push({ url: record.modelConfig.imageUrl, label: '模特' })
    }
    if (record.sceneConfig?.imageUrl) imgs.push({ url: record.sceneConfig.imageUrl, label: '场景' })
    return imgs
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="hidden md:block mb-1">
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #c67b5c 0%, #d4a882 100%)' }}
            >
              <Clock className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-[28px] font-bold tracking-tight text-[#2d2422]">历史记录</h1>
          </div>
          <p className="text-[13px] text-[#9b8e82] ml-[52px] tracking-wide">查看你的所有生图任务、状态与结果图片</p>
        </div>

        {error ? (
          <div className="bg-[#fef2f0] text-[#c47070] px-5 py-3.5 rounded-2xl text-sm font-medium border border-[#f0d5d0]">{error}</div>
        ) : null}

        {loading ? (
          <div className="fashion-glass rounded-2xl p-12 text-center">
            <Loader2 className="w-7 h-7 text-[#c67b5c] animate-spin mx-auto mb-4" />
            <p className="text-[13px] text-[#9b8e82]">加载中...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="fashion-glass rounded-2xl p-12 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(198,123,92,0.08)' }}>
              <Clock className="w-7 h-7 text-[#c67b5c]" style={{ opacity: 0.5 }} />
            </div>
            <h3 className="text-[15px] font-semibold text-[#b0a59a] mb-1">暂无记录</h3>
            <p className="text-[13px] text-[#c9bfb5]">去工作台、模特合成或 AI 改款创建第一张图吧</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {records.map((record) => {
              const typeConf = TYPE_CONFIG[record.type] || TYPE_CONFIG['workspace']
              const TypeIcon = typeConf.icon
              const resultImages = getResultImages(record)
              const refImages = getRefImages(record)

              return (
                <article key={record.id} className="fashion-glass rounded-2xl p-4 sm:p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${typeConf.bg} ${typeConf.color}`}>
                        <TypeIcon className="w-3 h-3" />
                        {typeConf.label}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${getStatusStyle(record.status)}`}>
                        {record.status === 'COMPLETED' ? '已完成' : record.status === 'FAILED' ? '失败' : record.status}
                      </span>
                      <span className="text-[#b0a59a] text-[11px]">{formatDateTime(record.createdAt)}</span>
                    </div>
                    <button
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium text-[#c47070] bg-[rgba(196,112,112,0.04)] border border-[rgba(196,112,112,0.1)] hover:bg-[rgba(196,112,112,0.08)] active:bg-[rgba(196,112,112,0.12)] transition-all"
                      onClick={() => handleDelete(record.id)}
                    >
                      <Trash2 className="w-3 h-3" /> 删除
                    </button>
                  </div>

                  {/* 描述行 */}
                  {record.clothingDescription && (
                    <p className="text-[12px] text-[#9b8e82] mb-3 leading-relaxed">{record.clothingDescription}</p>
                  )}

                  <div className="grid grid-cols-3 gap-2 p-3 bg-[rgba(139,115,85,0.03)] rounded-xl mb-3">
                    <div>
                      <div className="text-[10px] font-semibold text-[#b0a59a] uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Hash className="w-3 h-3" /> ID
                      </div>
                      <div className="inline-block px-2 py-0.5 bg-[rgba(139,115,85,0.04)] rounded-md font-mono text-[11px] text-[#8b7355]">{record.id.slice(0, 8)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-[#b0a59a] uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Coins className="w-3 h-3" /> 积分
                      </div>
                      <div className="text-[13px] text-[#2d2422] font-medium">{record.creditCost}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-[#b0a59a] uppercase tracking-wider mb-1 flex items-center gap-1">
                        <CalendarCheck className="w-3 h-3" /> 完成
                      </div>
                      <div className="text-[11px] text-[#8b7355]">{formatDateTime(record.finishedAt)}</div>
                    </div>
                  </div>

                  {(refImages.length > 0 || resultImages.length > 0) && (
                    <div className="flex flex-col gap-4">
                      {refImages.length > 0 && (
                        <div>
                          <div className="text-[10px] font-semibold text-[#b0a59a] uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Image className="w-3 h-3" /> 参考图片
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {refImages.map((img, idx) => (
                              <div key={idx} className="relative w-16 h-[86px] sm:w-20 sm:h-[107px] rounded-[10px] overflow-hidden border border-[rgba(139,115,85,0.1)] cursor-pointer active:opacity-80 transition-opacity" onClick={() => setPreviewImage(img.url)}>
                                <LazyImage src={img.url} alt={img.label} onClick={() => setPreviewImage(img.url)} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {resultImages.length > 0 && (
                        <div>
                          <div className="text-[10px] font-semibold text-[#b0a59a] uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Maximize2 className="w-3 h-3" /> 生成结果
                            {resultImages.length > 1 && (
                              <span className="text-[#c67b5c] ml-1">({resultImages.length}张)</span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {resultImages.map((url, idx) => (
                              <div key={idx} className="relative aspect-[3/4] rounded-[10px] overflow-hidden border border-[rgba(139,115,85,0.1)] cursor-pointer active:opacity-80 transition-opacity group" onClick={() => setPreviewImage(url)}>
                                <LazyImage src={url} alt={`结果 ${idx + 1}`} onClick={() => setPreviewImage(url)} />
                                {resultImages.length > 1 && (
                                  <div className="absolute bottom-1 left-1 bg-black/50 text-white px-1.5 py-0.5 rounded text-[9px] font-semibold">{idx + 1}</div>
                                )}
                                {!upscalingTaskIds.has(record.id) && (
                                  <button
                                    className="absolute top-1 right-1 bg-[#c67b5c]/90 hover:bg-[#b0654a] text-white px-2 py-0.5 rounded-md text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 z-10"
                                    onClick={(e) => { e.stopPropagation(); setUpscaleModal({ taskId: record.id, imageUrl: url }); }}
                                  >
                                    <Sparkles className="w-2.5 h-2.5" /> 变高清
                                  </button>
                                )}
                              </div>
                            ))}
                            {record.upscaledUrl && (
                              <div className="relative aspect-[3/4] rounded-[10px] overflow-hidden border-2 border-green-400 cursor-pointer active:opacity-80 transition-opacity" onClick={() => setPreviewImage(record.upscaledUrl!)}>
                                <div className="absolute top-1 left-1 bg-green-500 text-white px-1.5 py-0.5 rounded text-[9px] font-bold z-10">{record.upscaleFactor}x</div>
                                <LazyImage src={record.upscaledUrl} alt={`放大 ${record.upscaleFactor}x 结果`} onClick={() => setPreviewImage(record.upscaledUrl!)} />
                              </div>
                            )}
                            {!record.upscaledUrl && upscalingTaskIds.has(record.id) && (
                              <div className="flex items-center justify-center bg-[rgba(139,115,85,0.04)] rounded-xl aspect-[3/4] flex-col gap-2">
                                <Loader2 className="w-5 h-5 text-[#c67b5c] animate-spin" />
                                <div className="text-[12px] text-[#9b8e82]">放大中...</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {record.errorMsg ? (
                    <div className="mt-3 bg-[#fef2f0] text-[#c47070] px-4 py-3 rounded-xl text-[13px] font-medium border border-[#f0d5d0]">
                      失败原因：{record.errorMsg}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </div>

      {previewImage && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-[1000] p-4 cursor-pointer" onClick={() => { setPreviewImage(null); setPreviewSize(null) }}>
          {/* 拍立得卡片 */}
          <div
            className="relative bg-white rounded-sm shadow-[0_8px_40px_rgba(0,0,0,0.45),0_2px_8px_rgba(0,0,0,0.2)] cursor-default"
            style={{
              padding: '10px 10px 48px 10px',
              transform: 'rotate(-1.5deg)',
              ...(previewSize ? {
                width: `${previewSize.width}px`,
                height: `${previewSize.height}px`,
              } : {}),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImage}
              alt="预览图片"
              className="block w-full h-full object-contain"
              style={{ boxShadow: 'inset 0 0 20px rgba(0,0,0,0.03)' }}
              onLoad={(e) => {
                const img = e.currentTarget
                const naturalW = img.naturalWidth
                const naturalH = img.naturalHeight
                if (!naturalW || !naturalH) return
                const maxW = window.innerWidth * 0.92 - 20
                const maxH = window.innerHeight * 0.85 - 58
                const scale = Math.min(maxW / naturalW, maxH / naturalH, 1)
                setPreviewSize({
                  width: Math.round(naturalW * scale),
                  height: Math.round(naturalH * scale),
                })
              }}
            />
            {/* 拍立得底部文字区 */}
            <div className="absolute bottom-2 left-0 right-0 flex justify-center">
              <span className="text-[11px] text-[#999] font-light tracking-wider" style={{ fontFamily: 'Georgia, serif' }}>这个款真好看！！！</span>
            </div>
            {/* 关闭按钮 */}
            <button
              className="absolute -top-2 -right-2 w-8 h-8 bg-white shadow-lg text-[#666] border-none rounded-full flex items-center justify-center cursor-pointer hover:text-[#333] active:scale-90 transition-all z-10"
              onClick={() => { setPreviewImage(null); setPreviewSize(null) }}
            >
              <X className="w-4 h-4" />
            </button>
            {/* 下载按钮 */}
            <button
              className="absolute -bottom-2 -right-2 w-9 h-9 bg-white shadow-lg text-[#c67b5c] border-none rounded-full flex items-center justify-center cursor-pointer hover:text-[#b0654a] active:scale-90 transition-all z-10"
              onClick={() => void handleDownload(previewImage, 'preview')}
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/40 rounded-full px-5 py-2 text-white/80 text-[12px] pointer-events-none sm:hidden">
            点击空白区域关闭
          </div>
        </div>
      )}

      {upscaleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-6" onClick={() => !upscaleLoading && setUpscaleModal(null)}>
          <div className="relative max-w-[480px] w-full bg-white/85 backdrop-blur-[40px] rounded-3xl border border-white/80 shadow-2xl p-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold text-[#2d2422] mb-2">高清放大</h3>
            <p className="text-[#9b8e82] text-sm mb-6">选择放大倍数，提升图片分辨率和清晰度</p>
            <div className="flex gap-4 mb-6">
              <button
                className="flex-1 p-4 bg-[rgba(139,115,85,0.03)] hover:bg-[rgba(139,115,85,0.06)] border border-[rgba(139,115,85,0.08)] rounded-xl cursor-pointer transition-all disabled:cursor-not-allowed"
                onClick={() => handleUpscale(2)}
                disabled={upscaleLoading}
              >
                <div className="text-2xl font-bold text-[#2d2422] mb-2">2x</div>
                <div className="text-[11px] text-[#9b8e82]">消耗 1 积分</div>
              </button>
            </div>
            {upscaleLoading && (
              <div className="text-center p-4 bg-[rgba(198,123,92,0.04)] rounded-xl">
                <Loader2 className="w-5 h-5 text-[#c67b5c] animate-spin mx-auto mb-2" />
                <div className="text-[13px] text-[#9b8e82]">正在放大图片...</div>
              </div>
            )}
            <button
              className="w-full mt-4 inline-flex items-center justify-center px-5 py-2.5 bg-[rgba(139,115,85,0.03)] text-[#8b7355] border border-[rgba(139,115,85,0.08)] rounded-xl text-[13px] font-medium hover:bg-[rgba(139,115,85,0.06)] transition-all disabled:opacity-50"
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
