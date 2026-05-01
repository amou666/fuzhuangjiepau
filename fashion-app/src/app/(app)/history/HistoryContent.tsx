'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { workspaceApi } from '@/lib/api/workspace';
import { LazyImage } from '@/lib/components/LazyImage';
import { useAuthStore } from '@/lib/stores/authStore';
import { useDraftStore } from '@/lib/stores/draftStore';
import { useNotificationStore } from '@/lib/stores/notificationStore';
import { showBottomProgress } from '@/lib/components/common/BottomProgress';
import { useHistoryRecords } from '@/lib/hooks/useSWRCache';
import { mutate as globalMutate } from 'swr';
import type { GenerationTask } from '@/lib/types';
import { getErrorMessage } from '@/lib/utils/api';
import { formatDateTime } from '@/lib/utils/format';
import { Clock, Trash2, ZoomIn, Download, Maximize2, Loader2, X, Image as ImageIcon, Coins, Hash, CalendarCheck, Drama, Wand2, Sparkles, PackageCheck, CheckSquare, Square, GitCompareArrows, Star, ThumbsUp, ThumbsDown, ListChecks, ChevronDown, ChevronLeft, ChevronRight, Minimize2, Box, Palette, FileText, AlertCircle, Send, Heart, MapPin, Merge, MessageSquare } from 'lucide-react';
import { ComparePanel } from '@/lib/components/history/ComparePanel';


const TYPE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  'workspace': { label: '工作台', icon: Sparkles, color: 'text-[#c67b5c]', bg: 'bg-[rgba(198,123,92,0.08)]' },
  'quick-workspace': { label: '快速工作台', icon: Sparkles, color: 'text-[#c67b5c]', bg: 'bg-[rgba(198,123,92,0.08)]' },
  'model-fusion': { label: '模特合成', icon: Drama, color: 'text-[#8b7355]', bg: 'bg-[rgba(139,115,85,0.08)]' },
  'redesign': { label: 'AI改款', icon: Wand2, color: 'text-[#b0654a]', bg: 'bg-[rgba(176,101,74,0.08)]' },
  'ghost-mannequins': { label: '一键3D图', icon: Box, color: 'text-[#c67b5c]', bg: 'bg-[rgba(198,123,92,0.08)]' },
  'recolor': { label: 'AI改色', icon: Palette, color: 'text-[#6366f1]', bg: 'bg-[rgba(99,102,241,0.08)]' },
  'production-sheet': { label: '生产单', icon: FileText, color: 'text-[#8b7355]', bg: 'bg-[rgba(139,115,85,0.08)]' },
}

function CollapseToggle({
  collapsed,
  onToggle,
  compact,
}: {
  collapsed: boolean
  onToggle: () => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? '展开记录详情' : '折叠记录详情'}
      title={collapsed ? '展开记录详情' : '折叠记录详情'}
      className="inline-flex items-center gap-1 rounded-xl border transition-all whitespace-nowrap"
      style={{
        height: compact ? 32 : 36,
        padding: compact ? '0 10px' : '0 12px',
        background: collapsed ? 'rgba(198,123,92,0.08)' : 'rgba(139,115,85,0.04)',
        borderColor: collapsed ? 'rgba(198,123,92,0.3)' : 'rgba(139,115,85,0.1)',
        color: collapsed ? '#c67b5c' : '#8b7355',
      }}
    >
      {collapsed
        ? <Maximize2 className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        : <Minimize2 className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />}
      <span className={`${compact ? 'text-[11px]' : 'text-[12px]'} font-medium`}>{collapsed ? '展开' : '折叠'}</span>
    </button>
  )
}

function BatchMenu({
  allSelected,
  selectedCount,
  batchDownloading,
  onToggleAll,
  onDownload,
  onCompare,
  compact,
}: {
  allSelected: boolean
  selectedCount: number
  batchDownloading: boolean
  onToggleAll: () => void
  onDownload: () => void
  onCompare: () => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="批量操作"
        className="relative inline-flex items-center gap-1 rounded-xl border transition-all whitespace-nowrap"
        style={{
          height: compact ? 32 : 36,
          padding: compact ? '0 10px' : '0 12px',
          background: open ? 'rgba(198,123,92,0.08)' : 'rgba(139,115,85,0.04)',
          borderColor: open ? 'rgba(198,123,92,0.3)' : 'rgba(139,115,85,0.1)',
          color: '#8b7355',
        }}
      >
        <ListChecks className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        <span className={`${compact ? 'text-[11px]' : 'text-[12px]'} font-medium`}>批量</span>
        <ChevronDown className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} transition-transform ${open ? 'rotate-180' : ''}`} />
        {selectedCount > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #c67b5c, #d4a882)', boxShadow: '0 1px 4px rgba(198,123,92,0.35)' }}
          >
            {selectedCount}
          </span>
        )}
      </button>
      {open && (
        <>
          {/* 移动端：fixed 居中弹窗 */}
          <div className="fixed inset-0 bg-black/30 z-[998] md:hidden" onClick={() => setOpen(false)} />
          <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-[999] w-[calc(100vw-2rem)] max-w-[280px] bg-white rounded-2xl shadow-xl border border-[rgba(139,115,85,0.12)] overflow-hidden py-1 md:hidden animate-[toast-in_0.2s_ease-out]">
            <button
              type="button"
              className="w-full px-4 py-3 text-left text-[13px] text-[#2d2422] active:bg-[rgba(198,123,92,0.08)] flex items-center gap-2.5 transition-colors"
              onClick={onToggleAll}
            >
              {allSelected ? <CheckSquare className="w-4 h-4 text-[#c67b5c]" /> : <Square className="w-4 h-4 text-[#8b7355]" />}
              {allSelected ? '取消全选' : '全选已完成'}
            </button>
            <div className="h-px bg-[rgba(139,115,85,0.08)] mx-3" />
            <button
              type="button"
              disabled={selectedCount === 0 || batchDownloading}
              className="w-full px-4 py-3 text-left text-[13px] text-[#2d2422] active:bg-[rgba(198,123,92,0.08)] flex items-center gap-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => { onDownload(); setOpen(false) }}
            >
              {batchDownloading
                ? <Loader2 className="w-4 h-4 animate-spin text-[#c67b5c]" />
                : <PackageCheck className="w-4 h-4 text-[#c67b5c]" />}
              {batchDownloading ? '打包中...' : `打包下载${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
            </button>
            <div className="h-px bg-[rgba(139,115,85,0.08)] mx-3" />
            <button
              type="button"
              disabled={selectedCount < 2}
              className="w-full px-4 py-3 text-left text-[13px] text-[#2d2422] active:bg-[rgba(198,123,92,0.08)] flex items-center gap-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => { onCompare(); setOpen(false) }}
            >
              <GitCompareArrows className="w-4 h-4 text-[#8b7355]" />
              对比{selectedCount >= 2 ? ` (${selectedCount})` : ''}
            </button>
          </div>
          {/* 桌面端：absolute 下拉菜单 */}
          <div className="hidden md:block absolute right-0 top-full mt-1.5 z-50 min-w-[180px] bg-white rounded-xl shadow-xl border border-[rgba(139,115,85,0.12)] overflow-hidden py-1">
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-[12px] text-[#2d2422] hover:bg-[rgba(198,123,92,0.06)] flex items-center gap-2 transition-colors"
              onClick={onToggleAll}
            >
              {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-[#c67b5c]" /> : <Square className="w-3.5 h-3.5 text-[#8b7355]" />}
              {allSelected ? '取消全选' : '全选已完成'}
            </button>
            <div className="h-px bg-[rgba(139,115,85,0.08)] mx-2" />
            <button
              type="button"
              disabled={selectedCount === 0 || batchDownloading}
              className="w-full px-3 py-2 text-left text-[12px] text-[#2d2422] hover:bg-[rgba(198,123,92,0.06)] flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              onClick={() => { onDownload(); setOpen(false) }}
            >
              {batchDownloading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#c67b5c]" />
                : <PackageCheck className="w-3.5 h-3.5 text-[#c67b5c]" />}
              {batchDownloading ? '打包中...' : `打包下载${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
            </button>
            <button
              type="button"
              disabled={selectedCount < 2}
              className="w-full px-3 py-2 text-left text-[12px] text-[#2d2422] hover:bg-[rgba(198,123,92,0.06)] flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              onClick={() => { onCompare(); setOpen(false) }}
            >
              <GitCompareArrows className="w-3.5 h-3.5 text-[#8b7355]" />
              对比{selectedCount >= 2 ? ` (${selectedCount})` : ''}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

interface WatermarkCfg { enabled: boolean; text: string; position: string; opacity: number; fontSize: number }

function applyWatermarkToCanvas(canvas: HTMLCanvasElement, wm: WatermarkCfg) {
  if (!wm.enabled || !wm.text.trim()) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.font = `bold ${wm.fontSize}px Arial, sans-serif`
  ctx.fillStyle = `rgba(255,255,255,${wm.opacity})`
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 3
  let x = canvas.width - 20
  let y = canvas.height - 20
  ctx.textAlign = 'end'
  switch (wm.position) {
    case 'top-left': x = 20; y = wm.fontSize + 20; ctx.textAlign = 'start'; break
    case 'top-right': x = canvas.width - 20; y = wm.fontSize + 20; break
    case 'bottom-left': x = 20; y = canvas.height - 20; ctx.textAlign = 'start'; break
    case 'center': x = canvas.width / 2; y = canvas.height / 2; ctx.textAlign = 'center'; break
  }
  ctx.fillText(wm.text.trim(), x, y)
  ctx.shadowBlur = 0
}

export default function HistoryContent() {
  const router = useRouter()
  const updateCredits = useAuthStore((state) => state.updateCredits);
  const addNotification = useNotificationStore((state) => state.add);
  const setQuickWorkspaceDraft = useDraftStore((state) => state.setQuickWorkspaceDraft);
  const { allRecords, error: swrError, isLoading, hasCache, mutateRecords } = useHistoryRecords();
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
  const loading = isLoading && !hasCache;
  const error = swrError ? getErrorMessage(swrError, '加载历史记录失败') : '';
  const totalCount = allRecords.length;
  const records = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return allRecords.slice(start, start + PAGE_SIZE);
  }, [allRecords, currentPage]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewRecord, setPreviewRecord] = useState<GenerationTask | null>(null);
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number } | null>(null);
  const [sendTarget, setSendTarget] = useState<'clothing' | 'clothingBack' | 'model' | 'scene' | null>(null);
  const [upscaleModal, setUpscaleModal] = useState<{ taskId: string; imageUrl: string } | null>(null);
  const [upscaleLoading, setUpscaleLoading] = useState(false);
  const [upscalingTaskIds, setUpscalingTaskIds] = useState<Set<string>>(new Set());
  const upscaleTimersRef = useRef<Map<string, { interval: ReturnType<typeof setInterval>; timeout: ReturnType<typeof setTimeout> }>>(new Map());
  const watermarkRef = useRef<WatermarkCfg | null>(null);

  useEffect(() => {
    const timers = upscaleTimersRef;
    return () => {
      timers.current.forEach(({ interval, timeout }) => {
        clearInterval(interval);
        clearTimeout(timeout);
      });
      timers.current.clear();
    };
  }, []);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDownloading, setBatchDownloading] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Record<string, number>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try { return window.localStorage.getItem('fashion-history-collapsed') === '1' } catch { return false }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return
    try { window.localStorage.setItem('fashion-history-collapsed', collapsed ? '1' : '0') } catch { /* ignore */ }
  }, [collapsed]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const completedIds = records.filter((r) => r.status === 'COMPLETED').map((r) => r.id);
    if (completedIds.every((id) => selectedIds.has(id)) && completedIds.length > 0) {
      // 当前页已全选 → 取消当前页的选中（保留其他页的）
      setSelectedIds((prev) => {
        const next = new Set(prev);
        completedIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      // 选中当前页所有已完成记录
      setSelectedIds((prev) => {
        const next = new Set(prev);
        completedIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleBatchDownload = async () => {
    if (selectedIds.size === 0) return;
    // 只下载已完成任务的记录
    const completedIds = Array.from(selectedIds).filter((id) => {
      const record = allRecords.find((r) => r.id === id);
      return record?.status === 'COMPLETED';
    });
    if (completedIds.length === 0) {
      addNotification({ type: 'error', message: '所选记录中没有已完成的任务，无法下载' });
      return;
    }
    setBatchDownloading(true);
    try {
      await workspaceApi.downloadBatchZip(completedIds);
    } catch (err) {
      console.error('打包下载失败', err);
      addNotification({ type: 'error', message: '打包下载失败，请重试' });
    } finally {
      setBatchDownloading(false);
    }
  };

  useEffect(() => {
    void workspaceApi.getWatermarkConfig().then((wm) => { watermarkRef.current = wm; }).catch(() => {});
  }, []);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  // 删除记录后分页越界自动修正
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, currentPage])

  const handleDownload = async (url: string, taskId: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const wm = watermarkRef.current;

      if (wm?.enabled && wm.text.trim()) {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        const objectUrl = URL.createObjectURL(blob);
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('image load failed'));
          img.src = objectUrl;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        applyWatermarkToCanvas(canvas, wm);
        URL.revokeObjectURL(objectUrl);

        canvas.toBlob((wmBlob) => {
          if (!wmBlob) return;
          const downloadUrl = URL.createObjectURL(wmBlob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `fashion-ai-${taskId}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(downloadUrl);
        }, 'image/png');
      } else {
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `fashion-ai-${taskId}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      }
    } catch (err) {
      console.error('下载失败', err);
      alert('下载失败，请重试');
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await workspaceApi.deleteTask(taskId);
      // 乐观更新：从 SWR 缓存中移除该记录
      mutateRecords((prev) => (prev ?? []).filter((r) => r.id !== taskId), false);
      // 从选中列表中移除该 ID
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('删除失败', err);
      addNotification({ type: 'error', message: '删除失败，请重试' });
    }
  };

  const handleFeedback = async (taskId: string, rating: number) => {
    try {
      await workspaceApi.submitFeedback(taskId, rating);
      setFeedbacks((prev) => ({ ...prev, [taskId]: rating }));
    } catch {
      // silently fail
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
      // 清理同一任务之前的定时器
      const existing = upscaleTimersRef.current.get(taskId);
      if (existing) { clearInterval(existing.interval); clearTimeout(existing.timeout); }
      const pollInterval = setInterval(async () => {
        try {
          const task = await workspaceApi.getTask(taskId);
          // 放大成功：upscaledUrl 有值
          if (task.upscaledUrl) {
            mutateRecords((prev) => (prev ?? []).map(r => r.id === taskId ? task : r), false);
            setUpscalingTaskIds(prev => {
              const next = new Set(prev);
              next.delete(taskId);
              return next;
            });
            clearInterval(pollInterval);
            clearTimeout(pollTimeout);
            polled = true;
            upscaleTimersRef.current.delete(taskId);
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
            clearTimeout(pollTimeout);
            polled = true;
            upscaleTimersRef.current.delete(taskId);
            // 失败会退款，刷新积分
            try { updateCredits(await workspaceApi.getBalance()); } catch {}
            alert(task.errorMsg || '放大失败，请重试');
          }
        } catch {
          // polling error continue
        }
      }, 2000);

      const pollTimeout = setTimeout(() => {
        clearInterval(pollInterval);
        if (!polled) {
          setUpscalingTaskIds(prev => {
            const next = new Set(prev);
            next.delete(taskId);
            return next;
          });
          upscaleTimersRef.current.delete(taskId);
          // 超时也刷新积分
          workspaceApi.getBalance().then(updateCredits).catch(() => {});
          alert('放大超时，请稍后在历史记录中查看结果');
        }
      }, 120000);

      upscaleTimersRef.current.set(taskId, { interval: pollInterval, timeout: pollTimeout });
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
    if (s === 'completed') return 'bg-green-100 text-green-700';
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
      <div className="flex flex-col gap-4 md:gap-5">
        <div className="md:hidden flex items-center gap-2 -mb-1">
          {records.length > 0 && (
            <CollapseToggle compact collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
          )}
          {records.length > 0 && (
            <BatchMenu
              compact
              allSelected={records.filter((r) => r.status === 'COMPLETED').every((r) => selectedIds.has(r.id)) && selectedIds.size > 0}
              selectedCount={selectedIds.size}
              batchDownloading={batchDownloading}
              onToggleAll={toggleSelectAll}
              onDownload={handleBatchDownload}
              onCompare={() => setShowCompare(true)}
            />
          )}

        </div>

        {error ? (
          <div className="bg-[#fef2f0] text-[#c47070] px-5 py-3.5 rounded-2xl text-sm font-medium border border-[#f0d5d0]">{error}</div>
        ) : null}

        {loading ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="fashion-glass rounded-2xl p-3 md:p-5" style={{ animation: `fade-up 0.4s ease-out ${i * 0.06}s both` }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-20 h-6 rounded-full" style={{ backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                  <div className="w-16 h-5 rounded-full" style={{ backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                  <div className="w-24 h-4 rounded-full ml-auto" style={{ backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                </div>
                <div className="w-3/4 h-4 rounded mb-3" style={{ backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                <div className="flex gap-3 mb-3">
                  <div className="w-[110px] h-[80px] rounded-xl shrink-0" style={{ backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                  <div className="flex-1 flex gap-2">
                    <div className="w-16 h-[80px] rounded-[10px]" style={{ backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                    <div className="w-16 h-[80px] rounded-[10px]" style={{ backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="aspect-[3/4] rounded-xl" style={{ backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                  <div className="aspect-[3/4] rounded-xl" style={{ backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                  <div className="aspect-[3/4] rounded-xl" style={{ backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                </div>
              </div>
            ))}
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
          <div className={`grid items-start gap-4 md:gap-5 ${
            collapsed
              ? 'grid-cols-1 md:grid-cols-2 2xl:grid-cols-3'
              : 'grid-cols-1 xl:grid-cols-2'
          }`}>
            {records.map((record, index) => {
              const typeConf = TYPE_CONFIG[record.type] || TYPE_CONFIG['workspace']
              const TypeIcon = typeConf.icon
              const resultImages = getResultImages(record)
              const refImages = getRefImages(record)

              const isCompleted = record.status === 'COMPLETED';
              const isSelected = selectedIds.has(record.id);

              return (
                <article key={record.id} className="fashion-glass rounded-2xl p-3 sm:p-5 shadow-sm relative" style={{
                  animation: `fade-up 0.4s ease-out ${index * 0.06}s both`,
                  ...(isSelected ? { outline: '2px solid rgba(198,123,92,0.4)', outlineOffset: '-1px' } : {}),
                }}>
                  {/* Mobile: 删除按钮浮于卡片右上角 */}
                  <button
                    type="button"
                    aria-label="删除记录"
                    className="md:hidden absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white/85 backdrop-blur-sm text-[#c47070] flex items-center justify-center shadow-sm active:scale-90 transition-all"
                    onClick={() => setDeleteConfirmId(record.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pr-10 md:pr-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Checkbox */}
                      {isCompleted && (
                        <button
                          type="button"
                          className="w-5 h-5 rounded flex items-center justify-center border transition-all cursor-pointer flex-shrink-0"
                          style={isSelected ? {
                            background: 'linear-gradient(135deg, #c67b5c, #d4a882)',
                            borderColor: 'transparent',
                          } : {
                            background: 'rgba(139,115,85,0.03)',
                            borderColor: 'rgba(139,115,85,0.15)',
                          }}
                          onClick={() => toggleSelect(record.id)}
                        >
                          {isSelected && (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      )}
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${typeConf.bg} ${typeConf.color}`}>
                        <TypeIcon className="w-3 h-3" />
                        {typeConf.label}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${getStatusStyle(record.status)}`}>
                        {record.status === 'COMPLETED' ? '已完成' : record.status === 'FAILED' ? '失败' : record.status}
                      </span>
                      {/* 快速工作台模式标识 */}
                      {record.type === 'quick-workspace' && (record.sceneConfig as any)?.quickMode && (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          (record.sceneConfig as any).quickMode === 'fusion'
                            ? 'bg-[rgba(139,92,198,0.08)] text-[#8b5cc6]'
                            : 'bg-[rgba(125,155,118,0.08)] text-[#7d9b76]'
                        }`}>
                          {(record.sceneConfig as any).quickMode === 'fusion' ? <Merge className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                          {(record.sceneConfig as any).quickMode === 'fusion' ? '融合模式' : '背景图模式'}
                        </span>
                      )}
                      <span className="text-[#b0a59a] text-[11px]">{formatDateTime(record.createdAt)}</span>
                    </div>
                    {/* Desktop: 文字 + 图标 删除按钮 */}
                    <button
                      className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium text-[#c47070] bg-[rgba(196,112,112,0.04)] border border-[rgba(196,112,112,0.1)] hover:bg-[rgba(196,112,112,0.08)] active:bg-[rgba(196,112,112,0.12)] transition-all"
                      onClick={() => setDeleteConfirmId(record.id)}
                    >
                      <Trash2 className="w-3 h-3" /> 删除
                    </button>
                  </div>

                  {/* 描述行 */}
                  {!collapsed && record.clothingDescription && (
                    <p className="text-[12px] text-[#9b8e82] mb-3 leading-relaxed">{record.clothingDescription}</p>
                  )}

                  {/* 用户自定义提示词 */}
                  {!collapsed && (record.sceneConfig as any)?.prompt && (
                    <div className="flex items-start gap-2 mb-3 p-2.5 bg-[rgba(198,123,92,0.04)] rounded-xl border border-[rgba(198,123,92,0.08)]">
                      <MessageSquare className="w-3.5 h-3.5 text-[#c67b5c] flex-shrink-0 mt-0.5" />
                      <p className="text-[12px] text-[#6b5c4e] leading-relaxed break-all">{(record.sceneConfig as any).prompt}</p>
                    </div>
                  )}

                  {/* 信息行：ID/积分/完成时间横向排列 */}
                  {!collapsed && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 p-2 bg-[rgba(139,115,85,0.03)] rounded-xl">
                      <div className="flex items-center gap-1">
                        <Hash className="w-3 h-3 text-[#b0a59a]" />
                        <span className="inline-block px-1.5 py-[1px] bg-[rgba(139,115,85,0.05)] rounded font-mono text-[10px] text-[#8b7355]">{record.id.slice(0, 8)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Coins className="w-3 h-3 text-[#b0a59a]" />
                        <span className="text-[11px] text-[#2d2422] font-medium">{record.creditCost} 积分</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CalendarCheck className="w-3 h-3 text-[#b0a59a]" />
                        <span className="text-[11px] text-[#8b7355]">{formatDateTime(record.finishedAt)}</span>
                      </div>
                    </div>
                  )}

                  {/* 参考图片 */}
                  {!collapsed && refImages.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[10px] font-semibold text-[#b0a59a] uppercase tracking-wider mb-2 flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" /> 参考图片
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {refImages.map((img, idx) => (
                          <div key={idx} className="relative w-16 h-[86px] sm:w-[72px] sm:h-[96px] rounded-[10px] overflow-hidden border border-[rgba(139,115,85,0.1)] cursor-pointer active:opacity-80 transition-opacity" onClick={() => { setPreviewImage(img.url); setPreviewRecord(record); }}>
                            <LazyImage src={img.url} alt={img.label} onClick={() => { setPreviewImage(img.url); setPreviewRecord(record); }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 生成结果：占满宽度，使用容器查询根据卡片宽度自适应列数 */}
                  {resultImages.length > 0 && (
                    <div className="@container">
                      {!collapsed && (
                        <div className="text-[10px] font-semibold text-[#b0a59a] uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Maximize2 className="w-3 h-3" /> 生成结果
                          {resultImages.length > 1 && (
                            <span className="text-[#c67b5c] ml-1">({resultImages.length}张)</span>
                          )}
                        </div>
                      )}
                      <div className="grid grid-cols-2 @md:grid-cols-3 @4xl:grid-cols-4 gap-3">
                        {resultImages.map((url, idx) => (
                          <div key={idx} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-[rgba(139,115,85,0.1)] cursor-pointer active:opacity-80 transition-opacity" onClick={() => { setPreviewImage(url); setPreviewRecord(record); }}>
                            <LazyImage src={url} alt={`结果 ${idx + 1}`} onClick={() => { setPreviewImage(url); setPreviewRecord(record); }} />
                            {resultImages.length > 1 && (
                              <div className="absolute bottom-1.5 left-1.5 bg-black/55 text-white px-1.5 py-0.5 rounded text-[10px] font-semibold">{idx + 1}</div>
                            )}
                          </div>
                        ))}
                        {record.upscaledUrl && (
                          <div className="relative aspect-[3/4] rounded-xl overflow-hidden border-2 border-green-400 cursor-pointer active:opacity-80 transition-opacity" onClick={() => { setPreviewImage(record.upscaledUrl!); setPreviewRecord(record); }}>
                            <div className="absolute top-1.5 left-1.5 bg-green-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold z-10">{record.upscaleFactor}x</div>
                            <LazyImage src={record.upscaledUrl} alt={`放大 ${record.upscaleFactor}x 结果`} onClick={() => { setPreviewImage(record.upscaledUrl!); setPreviewRecord(record); }} />
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

                  {/* Rating */}
                  {!collapsed && isCompleted && resultImages.length > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-[#b0a59a] uppercase tracking-wider">评价：</span>
                      {[1, 2, 3, 4, 5].map((star) => {
                        const currentRating = feedbacks[record.id] || 0;
                        return (
                          <button
                            key={star}
                            type="button"
                            className="p-0.5 transition-all hover:scale-110"
                            onClick={() => handleFeedback(record.id, star)}
                          >
                            <Star
                              className={`w-4 h-4 ${star <= currentRating ? 'text-[#d4a06a] fill-[#d4a06a]' : 'text-[#d9d2cb]'}`}
                            />
                          </button>
                        );
                      })}
                      {feedbacks[record.id] && (
                        <span className="text-[10px] text-[#b0a59a] ml-1">
                          {feedbacks[record.id] >= 4 ? '满意' : feedbacks[record.id] <= 2 ? '不满意' : '一般'}
                        </span>
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

        {/* 分页 */}
        {!loading && totalCount > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <span className="text-[13px] text-gray-500">共 {totalCount} 条记录</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="text-[13px] text-gray-600 tabular-nums min-w-[60px] text-center">{currentPage} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {previewImage && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-[1000] p-4 cursor-pointer" onClick={() => { setPreviewImage(null); setPreviewRecord(null); setPreviewSize(null) }}>
          {/* 拍立得卡片 */}
          <div
            className="relative bg-white rounded-sm shadow-[0_8px_40px_rgba(0,0,0,0.45),0_2px_8px_rgba(0,0,0,0.2)] cursor-default"
            style={{
              padding: '14px 14px 56px 14px',
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
              className="block w-full object-contain"
              style={{ boxShadow: 'inset 0 0 20px rgba(0,0,0,0.03)' }}
              onLoad={(e) => {
                const img = e.currentTarget
                const naturalW = img.naturalWidth
                const naturalH = img.naturalHeight
                if (!naturalW || !naturalH) return
                const padX = 28 // 14px * 2
                const padY = 70 // 14px top + 56px bottom
                const maxW = window.innerWidth * 0.92 - padX
                const maxH = window.innerHeight * 0.85 - padY
                const scale = Math.min(maxW / naturalW, maxH / naturalH, 1)
                setPreviewSize({
                  width: Math.round(naturalW * scale) + padX,
                  height: Math.round(naturalH * scale) + padY,
                })
              }}
            />
            {/* 操作按钮组 */}
            <div className="flex items-center justify-center gap-2 mt-3">
              <button
                className="w-9 h-9 bg-white shadow-lg text-[#8b7355] border-none rounded-full flex items-center justify-center cursor-pointer hover:text-[#c67b5c] active:scale-90 transition-all"
                onClick={() => {
                  if (!previewImage) return
                  const typeConf = TYPE_CONFIG[previewRecord?.type || 'workspace']
                  const typeName = typeConf?.label || '生图'
                  void workspaceApi.createFavorite({
                    type: 'clothing',
                    name: `${typeName} · ${new Date().toLocaleDateString('zh-CN')}`,
                    data: { imageUrl: previewImage, source: 'history' },
                    previewUrl: previewImage,
                  }).then(() => {
                    addNotification({ type: 'success', message: '已收藏到素材库' })
                    // 刷新收藏夹 SWR 缓存
                    globalMutate('/favorites')
                  }).catch(() => {
                    addNotification({ type: 'error', message: '收藏失败' })
                  })
                }}
                title="收藏到素材库"
              >
                <Heart className="w-4 h-4" />
              </button>
              <button
                className="w-9 h-9 bg-white shadow-lg text-[#8b7355] border-none rounded-full flex items-center justify-center cursor-pointer hover:text-[#c67b5c] active:scale-90 transition-all"
                onClick={() => {
                  if (!previewRecord) return
                  setUpscaleModal({ taskId: previewRecord.id, imageUrl: previewImage! })
                }}
                title="变高清"
              >
                <Sparkles className="w-4 h-4" />
              </button>
              <button
                className="w-9 h-9 bg-white shadow-lg text-[#8b7355] border-none rounded-full flex items-center justify-center cursor-pointer hover:text-[#c67b5c] active:scale-90 transition-all"
                onClick={() => setSendTarget('clothing')}
                title="发送到工作台"
              >
                <Send className="w-4 h-4" />
              </button>
              <button
                className="w-9 h-9 bg-white shadow-lg text-[#c67b5c] border-none rounded-full flex items-center justify-center cursor-pointer hover:text-[#b0654a] active:scale-90 transition-all"
                onClick={() => void handleDownload(previewImage!, 'preview')}
                title="下载"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
            {/* 关闭按钮 */}
            <button
              className="absolute -top-2 -right-2 w-8 h-8 bg-white shadow-lg text-[#666] border-none rounded-full flex items-center justify-center cursor-pointer hover:text-[#333] active:scale-90 transition-all z-10"
              onClick={() => { setPreviewImage(null); setPreviewRecord(null); setPreviewSize(null) }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/40 rounded-full px-5 py-2 text-white/80 text-[12px] pointer-events-none sm:hidden">
            点击空白区域关闭
          </div>
        </div>
      )}

      {showCompare && selectedIds.size >= 2 && (
        <ComparePanel
          tasks={allRecords.filter((r) => selectedIds.has(r.id))}
          onClose={() => setShowCompare(false)}
        />
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

      {/* 发送到工作台 - 选择目标弹窗 */}
      {sendTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-6" onClick={() => setSendTarget(null)}>
          <div className="relative max-w-[360px] w-full bg-white/95 backdrop-blur-[40px] rounded-2xl border border-white/80 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[14px] font-semibold text-[#2d2422] mb-1">发送到工作台</h3>
            <p className="text-[13px] text-[#9b8e82] mb-5">选择该图片在工作台中的用途</p>
            <div className="flex flex-col gap-2.5">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left"
                style={{ borderColor: 'rgba(139,115,85,0.12)', background: 'rgba(139,115,85,0.03)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(198,123,92,0.4)'; e.currentTarget.style.background = 'rgba(198,123,92,0.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(139,115,85,0.12)'; e.currentTarget.style.background = 'rgba(139,115,85,0.03)'; }}
                onClick={() => {
                  if (!previewImage) return
                  const qw = useDraftStore.getState().qw
                  const existing = useDraftStore.getState().quickWorkspaceDraft
                  setQuickWorkspaceDraft({
                    mode: existing?.mode ?? qw.mode ?? 'background',
                    clothingUrl: previewImage,
                    clothingBackUrl: existing?.clothingBackUrl ?? qw.clothingBackUrl ?? '',
                    modelImageUrl: existing?.modelImageUrl ?? qw.modelImageUrl ?? '',
                    sceneImageUrl: existing?.sceneImageUrl ?? qw.sceneImageUrl ?? '',
                    aspectRatio: existing?.aspectRatio ?? qw.aspectRatio ?? '3:4',
                    framing: existing?.framing ?? qw.framing ?? 'auto',
                    extraPrompt: existing?.extraPrompt ?? qw.extraPrompt ?? '',
                    device: existing?.device ?? qw.device ?? 'phone',
                  })
                  setSendTarget(null)
                  addNotification({ type: 'success', message: '已发送到工作台（服装正面），正在跳转...' })
                  showBottomProgress()
                  router.push('/quick-workspace')
                }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(198,123,92,0.08)' }}>
                  <ImageIcon className="w-4 h-4 text-[#c67b5c]" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#2d2422]">服装正面</div>
                  <div className="text-[11px] text-[#9b8e82]">作为工作台的服装主视图</div>
                </div>
              </button>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left"
                style={{ borderColor: 'rgba(139,115,85,0.12)', background: 'rgba(139,115,85,0.03)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(198,123,92,0.4)'; e.currentTarget.style.background = 'rgba(198,123,92,0.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(139,115,85,0.12)'; e.currentTarget.style.background = 'rgba(139,115,85,0.03)'; }}
                onClick={() => {
                  if (!previewImage) return
                  const qw = useDraftStore.getState().qw
                  const existing = useDraftStore.getState().quickWorkspaceDraft
                  setQuickWorkspaceDraft({
                    mode: existing?.mode ?? qw.mode ?? 'background',
                    clothingUrl: existing?.clothingUrl ?? qw.clothingUrl ?? '',
                    clothingBackUrl: previewImage,
                    modelImageUrl: existing?.modelImageUrl ?? qw.modelImageUrl ?? '',
                    sceneImageUrl: existing?.sceneImageUrl ?? qw.sceneImageUrl ?? '',
                    aspectRatio: existing?.aspectRatio ?? qw.aspectRatio ?? '3:4',
                    framing: existing?.framing ?? qw.framing ?? 'auto',
                    extraPrompt: existing?.extraPrompt ?? qw.extraPrompt ?? '',
                    device: existing?.device ?? qw.device ?? 'phone',
                  })
                  setSendTarget(null)
                  addNotification({ type: 'success', message: '已发送到工作台（服装反面），正在跳转...' })
                  showBottomProgress()
                  router.push('/quick-workspace')
                }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(198,123,92,0.08)' }}>
                  <ImageIcon className="w-4 h-4 text-[#c67b5c]" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#2d2422]">服装反面</div>
                  <div className="text-[11px] text-[#9b8e82]">作为工作台的服装背面图</div>
                </div>
              </button>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left"
                style={{ borderColor: 'rgba(139,115,85,0.12)', background: 'rgba(139,115,85,0.03)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(198,123,92,0.4)'; e.currentTarget.style.background = 'rgba(198,123,92,0.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(139,115,85,0.12)'; e.currentTarget.style.background = 'rgba(139,115,85,0.03)'; }}
                onClick={() => {
                  if (!previewImage) return
                  const qw = useDraftStore.getState().qw
                  const existing = useDraftStore.getState().quickWorkspaceDraft
                  setQuickWorkspaceDraft({
                    mode: existing?.mode ?? qw.mode ?? 'background',
                    clothingUrl: existing?.clothingUrl ?? qw.clothingUrl ?? '',
                    clothingBackUrl: existing?.clothingBackUrl ?? qw.clothingBackUrl ?? '',
                    modelImageUrl: previewImage,
                    sceneImageUrl: existing?.sceneImageUrl ?? qw.sceneImageUrl ?? '',
                    aspectRatio: existing?.aspectRatio ?? qw.aspectRatio ?? '3:4',
                    framing: existing?.framing ?? qw.framing ?? 'auto',
                    extraPrompt: existing?.extraPrompt ?? qw.extraPrompt ?? '',
                    device: existing?.device ?? qw.device ?? 'phone',
                  })
                  setSendTarget(null)
                  addNotification({ type: 'success', message: '已发送到工作台（模特），正在跳转...' })
                  showBottomProgress()
                  router.push('/quick-workspace')
                }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(198,123,92,0.08)' }}>
                  <Drama className="w-4 h-4 text-[#c67b5c]" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#2d2422]">模特</div>
                  <div className="text-[11px] text-[#9b8e82]">作为工作台的模特参考图</div>
                </div>
              </button>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left"
                style={{ borderColor: 'rgba(139,115,85,0.12)', background: 'rgba(139,115,85,0.03)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(198,123,92,0.4)'; e.currentTarget.style.background = 'rgba(198,123,92,0.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(139,115,85,0.12)'; e.currentTarget.style.background = 'rgba(139,115,85,0.03)'; }}
                onClick={() => {
                  if (!previewImage) return
                  const qw = useDraftStore.getState().qw
                  const existing = useDraftStore.getState().quickWorkspaceDraft
                  setQuickWorkspaceDraft({
                    mode: existing?.mode ?? qw.mode ?? 'background',
                    clothingUrl: existing?.clothingUrl ?? qw.clothingUrl ?? '',
                    clothingBackUrl: existing?.clothingBackUrl ?? qw.clothingBackUrl ?? '',
                    modelImageUrl: existing?.modelImageUrl ?? qw.modelImageUrl ?? '',
                    sceneImageUrl: previewImage,
                    aspectRatio: existing?.aspectRatio ?? qw.aspectRatio ?? '3:4',
                    framing: existing?.framing ?? qw.framing ?? 'auto',
                    extraPrompt: existing?.extraPrompt ?? qw.extraPrompt ?? '',
                    device: existing?.device ?? qw.device ?? 'phone',
                  })
                  setSendTarget(null)
                  addNotification({ type: 'success', message: '已发送到工作台（场景），正在跳转...' })
                  showBottomProgress()
                  router.push('/quick-workspace')
                }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(125,155,118,0.08)' }}>
                  <MapPin className="w-4 h-4 text-[#7d9b76]" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#2d2422]">场景</div>
                  <div className="text-[11px] text-[#9b8e82]">作为工作台的场景图</div>
                </div>
              </button>
            </div>
            <button
              className="w-full mt-4 py-2.5 rounded-xl text-[13px] font-medium bg-[rgba(139,115,85,0.03)] text-[#8b7355] border border-[rgba(139,115,85,0.08)] hover:bg-[rgba(139,115,85,0.06)] transition-all"
              onClick={() => setSendTarget(null)}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-6" onClick={() => setDeleteConfirmId(null)}>
          <div className="relative max-w-[380px] w-full bg-white/95 backdrop-blur-[40px] rounded-2xl border border-white/80 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-[14px] font-semibold text-[#2d2422]">确认删除</h3>
            </div>
            <p className="text-[13px] text-[#9b8e82] mb-5 leading-relaxed">删除后无法恢复，确定要删除这条记录吗？</p>
            <div className="flex gap-3">
              <button
                className="flex-1 py-2.5 rounded-xl text-[13px] font-medium bg-[rgba(139,115,85,0.03)] text-[#8b7355] border border-[rgba(139,115,85,0.08)] hover:bg-[rgba(139,115,85,0.06)] transition-all"
                onClick={() => setDeleteConfirmId(null)}
              >
                取消
              </button>
              <button
                className="flex-1 py-2.5 rounded-xl text-[13px] font-medium bg-red-500 text-white hover:bg-red-600 transition-all active:scale-95"
                onClick={() => void handleDelete(deleteConfirmId)}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
