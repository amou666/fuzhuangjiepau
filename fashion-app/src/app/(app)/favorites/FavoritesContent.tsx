'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { workspaceApi } from '@/lib/api/workspace'
import { useDraftStore } from '@/lib/stores/draftStore'
import { useFavorites, deleteFavoriteOptimistic } from '@/lib/hooks/useSWRCache'
import type { Favorite, FavoriteType } from '@/lib/types'
import { getErrorMessage } from '@/lib/utils/api'
import { formatDateTime } from '@/lib/utils/format'
import { Star, Trash2, Loader2, UserCircle, MapPin, Layers, ArrowRight, Shirt, Plus, Upload, X, Check, AlertCircle } from 'lucide-react'

import { ImageUploader } from '@/lib/components/common/ImageUploader'
import { LazyImage } from '@/lib/components/LazyImage'

const TYPE_TABS: { key: FavoriteType | 'all'; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'all', label: '全部', icon: Star },
  { key: 'clothing', label: '服装', icon: Shirt },
  { key: 'model', label: '模特', icon: UserCircle },
  { key: 'scene', label: '场景', icon: MapPin },
  { key: 'full', label: '完整配置', icon: Layers },
]

const TYPE_LABELS: Record<string, string> = {
  clothing: '服装',
  model: '模特',
  scene: '场景',
  full: '完整',
}

type UploadType = Extract<FavoriteType, 'clothing' | 'model' | 'scene'>

const UPLOAD_TYPES: { key: UploadType; label: string; icon: React.ComponentType<{ className?: string }>; desc: string; accent: string; bg: string }[] = [
  { key: 'clothing', label: '服装', icon: Shirt, desc: '衣服正面/反面图片', accent: '#b08060', bg: 'rgba(176,128,96,0.08)' },
  { key: 'model', label: '模特', icon: UserCircle, desc: '模特参考照片', accent: '#c67b5c', bg: 'rgba(198,123,92,0.08)' },
  { key: 'scene', label: '场景', icon: MapPin, desc: '拍摄背景 / 场景图', accent: '#7d9b76', bg: 'rgba(125,155,118,0.08)' },
]

function getConfigSummary(fav: Favorite): string {
  const d = fav.data as Record<string, any>
  if (fav.type === 'clothing') {
    const parts: string[] = []
    if (d.clothingBackUrl) parts.push('含反面图')
    return parts.join(' · ') || '服装图片'
  }
  if (fav.type === 'model') {
    const parts: string[] = []
    if (d.category) parts.push(d.category)
    if (d.ethnicity) parts.push(d.ethnicity)
    if (d.age) parts.push(`${d.age}岁`)
    if (d.pose) {
      const label = d.pose.match(/（(.+?)）/)?.[1] || d.pose.split('（')[0]
      parts.push(label)
    }
    if (parts.length === 0 && d.imageUrl) return '上传模特图'
    return parts.join(' · ') || '模特配置'
  }
  if (fav.type === 'scene') {
    const parts: string[] = []
    if (d.preset) {
      const label = d.preset.match(/（(.+?)）/)?.[1] || d.preset.split('（')[0]
      parts.push(label)
    }
    if (d.timeOfDay) parts.push(d.timeOfDay)
    if (d.lighting) parts.push(d.lighting)
    if (parts.length === 0 && d.imageUrl) return '上传场景图'
    return parts.join(' · ') || '场景配置'
  }
  if (fav.type === 'full') {
    const parts: string[] = []
    const imgCount = [d.clothingUrl, d.modelImageUrl, d.sceneImageUrl].filter((v) => typeof v === 'string' && v).length
    if (imgCount > 0) parts.push(`${imgCount} 图`)
    if (d.mode === 'background') parts.push('背景图')
    else if (d.mode === 'fusion') parts.push('融合')
    if (typeof d.aspectRatio === 'string') parts.push(d.aspectRatio)
    if (d.framing === 'half') parts.push('半身')
    else if (d.framing === 'full') parts.push('全身')
    return parts.join(' · ') || '完整配置'
  }
  return '完整配置'
}

function getFavoriteImageUrl(fav: Favorite): string {
  if (fav.previewUrl) return fav.previewUrl
  const data = fav.data as Record<string, unknown> | undefined
  const url = typeof data?.imageUrl === 'string' ? (data.imageUrl as string) : ''
  return url
}

/** 获取完整配置的所有图片（用于多图展示） */
function getFullConfigImages(fav: Favorite): { url: string; label: string }[] {
  const d = fav.data as Record<string, any>
  const images: { url: string; label: string }[] = []
  if (d.clothingUrl) images.push({ url: d.clothingUrl, label: '服装' })
  if (d.clothingBackUrl) images.push({ url: d.clothingBackUrl, label: '反面' })
  if (d.modelImageUrl) images.push({ url: d.modelImageUrl, label: '模特' })
  if (d.sceneImageUrl) images.push({ url: d.sceneImageUrl, label: '场景' })
  // 如果没有子图则用 previewUrl
  if (images.length === 0 && fav.previewUrl) images.push({ url: fav.previewUrl, label: '' })
  return images
}

export default function FavoritesContent() {
  const router = useRouter()
  const setQuickWorkspaceDraft = useDraftStore((s) => s.setQuickWorkspaceDraft)
  const { favorites, error: swrError, isLoading, hasCache, mutateFavorites } = useFavorites()
  const [activeTab, setActiveTab] = useState<FavoriteType | 'all'>('all')
  const [applyMsg, setApplyMsg] = useState('')
  const loading = isLoading && !hasCache
  const error = swrError ? getErrorMessage(swrError, '加载收藏失败') : ''

  // ─── 上传对话框状态 ───
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadType, setUploadType] = useState<UploadType>('clothing')
  const [uploadImageUrl, setUploadImageUrl] = useState('')
  const [uploadName, setUploadName] = useState('')
  const [uploadSaving, setUploadSaving] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    try {
      await deleteFavoriteOptimistic(id)
      setDeleteConfirmId(null)
    } catch {
      alert('删除失败')
    }
  }

  const openUploadDialog = useCallback((preset?: UploadType) => {
    setUploadType(preset ?? (activeTab === 'clothing' || activeTab === 'model' || activeTab === 'scene' ? activeTab : 'clothing'))
    setUploadImageUrl('')
    setUploadName('')
    setUploadOpen(true)
  }, [activeTab])

  const closeUploadDialog = useCallback(() => {
    if (uploadSaving) return
    setUploadOpen(false)
  }, [uploadSaving])

  const handleUploadSave = useCallback(async () => {
    if (!uploadImageUrl) {
      setApplyMsg('请先上传一张图片')
      setTimeout(() => setApplyMsg(''), 2000)
      return
    }
    const defaultName = `${UPLOAD_TYPES.find(t => t.key === uploadType)?.label ?? '素材'} · ${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`
    const name = uploadName.trim() || defaultName
    setUploadSaving(true)
    try {
      const favorite = await workspaceApi.createFavorite({
        type: uploadType,
        name,
        data: { imageUrl: uploadImageUrl },
        previewUrl: uploadImageUrl,
      })
      // 乐观更新：将新收藏插入 SWR 缓存
      mutateFavorites((prev) => [favorite, ...(prev ?? [])], false)
      setApplyMsg(`已添加到素材库：${name}`)
      setTimeout(() => setApplyMsg(''), 2000)
      setUploadOpen(false)
      setUploadImageUrl('')
      setUploadName('')
    } catch (err) {
      setApplyMsg(getErrorMessage(err, '保存失败'))
      setTimeout(() => setApplyMsg(''), 2500)
    } finally {
      setUploadSaving(false)
    }
  }, [uploadImageUrl, uploadName, uploadType, mutateFavorites])

  const handleApply = (fav: Favorite) => {
    const qw = useDraftStore.getState().qw
    const existing = useDraftStore.getState().quickWorkspaceDraft
    const base = {
      mode: existing?.mode ?? qw.mode ?? 'background' as const,
      clothingUrl: existing?.clothingUrl ?? qw.clothingUrl ?? '',
      clothingBackUrl: existing?.clothingBackUrl ?? qw.clothingBackUrl ?? '',
      modelImageUrl: existing?.modelImageUrl ?? qw.modelImageUrl ?? '',
      sceneImageUrl: existing?.sceneImageUrl ?? qw.sceneImageUrl ?? '',
      aspectRatio: existing?.aspectRatio ?? qw.aspectRatio ?? '3:4' as const,
      framing: existing?.framing ?? qw.framing ?? 'auto' as const,
      device: existing?.device ?? qw.device ?? 'phone',
      extraPrompt: existing?.extraPrompt ?? qw.extraPrompt ?? '',
    }

    const img = getFavoriteImageUrl(fav)
    const d = fav.data as Record<string, any>

    if (fav.type === 'clothing') {
      if (!img) {
        setApplyMsg('该服装收藏缺少图片，无法应用')
        setTimeout(() => setApplyMsg(''), 2000)
        return
      }
      setQuickWorkspaceDraft({
        ...base,
        clothingUrl: img,
        clothingBackUrl: typeof d.clothingBackUrl === 'string' ? d.clothingBackUrl : base.clothingBackUrl,
      })
    } else if (fav.type === 'model') {
      if (!img) {
        setApplyMsg('该模特收藏缺少图片，无法应用到快速工作台')
        setTimeout(() => setApplyMsg(''), 2000)
        return
      }
      setQuickWorkspaceDraft({ ...base, modelImageUrl: img })
    } else if (fav.type === 'scene') {
      if (!img) {
        setApplyMsg('该场景收藏缺少图片，无法应用到快速工作台')
        setTimeout(() => setApplyMsg(''), 2000)
        return
      }
      setQuickWorkspaceDraft({ ...base, sceneImageUrl: img })
    } else {
      const validMode = d.mode === 'background' || d.mode === 'fusion' ? d.mode : base.mode
      const validAspect = ['3:4', '1:1', '4:3', '16:9', '9:16'].includes(d.aspectRatio) ? d.aspectRatio : base.aspectRatio
      const validFraming = ['auto', 'half', 'full'].includes(d.framing) ? d.framing : base.framing
      setQuickWorkspaceDraft({
        ...base,
        mode: validMode,
        aspectRatio: validAspect,
        framing: validFraming,
        device: typeof d.device === 'string' && d.device.trim() ? d.device : base.device,
        extraPrompt: typeof d.extraPrompt === 'string' ? d.extraPrompt : base.extraPrompt,
        ...(typeof d.clothingUrl === 'string' ? { clothingUrl: d.clothingUrl } : {}),
        ...(typeof d.clothingBackUrl === 'string' ? { clothingBackUrl: d.clothingBackUrl } : {}),
        ...(typeof d.modelImageUrl === 'string' ? { modelImageUrl: d.modelImageUrl } : {}),
        ...(typeof d.sceneImageUrl === 'string' ? { sceneImageUrl: d.sceneImageUrl } : {}),
      })
    }

    setApplyMsg(`已应用「${fav.name}」到工作台，点击侧栏「工作台」查看`)
    setTimeout(() => setApplyMsg(''), 4000)
    // 不自动跳转，让用户自行决定何时去工作台
  }

  const filtered = activeTab === 'all' ? favorites : favorites.filter((f) => f.type === activeTab)

  return (
    <div className="flex flex-col gap-5">
      {applyMsg && (
        <button
          type="button"
          onClick={() => router.push('/quick-workspace')}
          className="fixed top-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-auto sm:max-w-md z-[999] flex items-center gap-3 pl-4 pr-2 py-2 rounded-2xl text-left transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_8px_30px_rgba(198,123,92,0.2)] animate-[toast-in_0.3s_ease-out]"
          style={{ background: 'white', border: '1px solid rgba(198,123,92,0.2)' }}
        >
          <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(34,197,94,0.1)' }}>
            <Check className="w-4 h-4 text-green-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[#3a2a1e] truncate">{applyMsg}</div>
            <div className="text-[11px] text-[#c67b5c] font-medium">点击前往工作台 →</div>
          </div>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #c67b5c, #d4a882)' }}>
            <ArrowRight className="w-4 h-4 text-white" />
          </div>
        </button>
      )}
      <div className="md:hidden flex items-center gap-2 -mb-1">
        <div
          className="hidden w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #d4a06a 0%, #c67b5c 100%)' }}
        >
          <Star className="w-4 h-4 text-white" />
        </div>
        <h1 className="hidden text-[18px] font-bold tracking-tight text-[#2d2422] flex-1">收藏夹</h1>

      </div>

      {/* Tabs + 刷新 */}
      <div className="-mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 w-max md:w-auto items-center">
          {TYPE_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all border cursor-pointer whitespace-nowrap flex-shrink-0"
              style={activeTab === key ? {
                background: 'linear-gradient(135deg, #c67b5c, #d4a882)',
                color: '#fff',
                borderColor: 'transparent',
                boxShadow: '0 2px 10px rgba(198,123,92,0.2)',
              } : {
                background: 'rgba(139,115,85,0.03)',
                color: '#8b7355',
                borderColor: 'rgba(139,115,85,0.08)',
              }}
              onClick={() => setActiveTab(key)}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {key !== 'all' && (
                <span className="text-[10px] opacity-70">
                  ({favorites.filter((f) => f.type === key).length})
                </span>
              )}
            </button>
          ))}

        </div>
      </div>

      {error && (
        <div className="bg-[#fef2f0] text-[#c47070] px-5 py-3.5 rounded-2xl text-sm font-medium border border-[#f0d5d0]">{error}</div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="fashion-glass rounded-2xl overflow-hidden" style={{ animation: `fade-up 0.4s ease-out ${i * 0.06}s both` }}>
              {/* 图片区骨架 */}
              <div className="w-full aspect-[3/4]" style={{
                backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.4s ease-in-out infinite',
              }} />
              {/* 信息区骨架 */}
              <div className="p-2 md:p-3 flex flex-col gap-1.5">
                <div className="w-3/4 h-3.5 rounded" style={{
                  backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.4s ease-in-out infinite',
                }} />
                <div className="w-1/2 h-3 rounded" style={{
                  backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.4s ease-in-out infinite',
                }} />
                <div className="w-2/5 h-2.5 rounded" style={{
                  backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.4s ease-in-out infinite',
                }} />
                <div className="w-full h-7 rounded-lg mt-1" style={{
                  backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.4), rgba(248,250,252,0.6), rgba(203,213,225,0.4))',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.4s ease-in-out infinite',
                }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="fashion-glass rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(212,160,106,0.08)' }}>
            <Star className="w-7 h-7 text-[#d4a06a]" style={{ opacity: 0.5 }} />
          </div>
          <h3 className="text-[15px] font-semibold text-[#b0a59a] mb-1">暂无收藏</h3>
          <p className="text-[13px] text-[#c9bfb5] mb-4">点击右上角「上传素材」添加，或在快速工作台 / 模特工厂生成后收藏</p>
          <button
            type="button"
            onClick={() => openUploadDialog()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #c67b5c, #d4a882)', boxShadow: '0 2px 12px rgba(198,123,92,0.3)' }}
          >
            <Plus className="w-3.5 h-3.5" />
            上传第一个素材
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
          {filtered.map((fav) => {
            const img = getFavoriteImageUrl(fav)
            const TypeIcon = fav.type === 'clothing' ? Shirt : fav.type === 'model' ? UserCircle : fav.type === 'scene' ? MapPin : Layers
            const iconColor = '#94a3b8'
            const bgColor = 'rgba(203,213,225,0.15)'
            const fullImages = fav.type === 'full' ? getFullConfigImages(fav) : []
            return (
              <div
                key={fav.id}
                className="fashion-glass rounded-2xl shadow-sm group overflow-hidden flex flex-col"
              >
                {/* 竖向长方形预览图 */}
                <div className="relative w-full aspect-[3/4] overflow-hidden" style={{ background: bgColor }}>
                  {fav.type === 'full' && fullImages.length > 1 ? (
                    /* 完整配置：多图网格展示 */
                    <div className="w-full h-full grid gap-0.5" style={{ gridTemplateColumns: fullImages.length <= 2 ? '1fr' : '1fr 1fr', gridTemplateRows: fullImages.length <= 2 ? '1fr 1fr' : '1fr 1fr' }}>
                      {fullImages.slice(0, 4).map((fi, idx) => (
                        <div key={idx} className="relative overflow-hidden" style={{ background: bgColor }}>
                          <LazyImage src={fi.url} alt={fi.label} />
                          {fi.label && (
                            <span className="absolute bottom-1 left-1 px-1 py-0.5 rounded text-[8px] font-semibold text-white" style={{ background: 'rgba(0,0,0,0.5)' }}>
                              {fi.label}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : img ? (
                    <LazyImage
                      src={img}
                      alt={fav.name}
                      wrapperClassName="relative w-full h-full transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <TypeIcon className="w-10 h-10" style={{ color: iconColor, opacity: 0.6 }} />
                    </div>
                  )}
                  {/* 类型标签 */}
                  <span
                    className="absolute top-2 left-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold backdrop-blur-sm"
                    style={
                      fav.type === 'clothing' ? { background: 'rgba(176,128,96,0.85)', color: '#fff' }
                      : fav.type === 'model' ? { background: 'rgba(198,123,92,0.85)', color: '#fff' }
                      : fav.type === 'scene' ? { background: 'rgba(125,155,118,0.85)', color: '#fff' }
                      : { background: 'rgba(139,115,85,0.85)', color: '#fff' }
                    }
                  >
                    {TYPE_LABELS[fav.type] || fav.type}
                  </span>
                  {/* 删除按钮 — 移动端常显，桌面端 hover 显 */}
                  <button
                    type="button"
                    className="absolute top-2 right-2 w-8 h-8 md:w-7 md:h-7 rounded-full bg-white/85 backdrop-blur-sm text-[#8b7355] hover:text-[#c47070] active:text-[#c47070] flex items-center justify-center shadow-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all active:scale-90"
                    aria-label="删除收藏"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteConfirmId(fav.id)
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* 信息区 */}
                <div className="p-2 md:p-3 flex flex-col gap-1.5 flex-1">
                  <div className="text-[12px] md:text-[13px] font-semibold text-[#2d2422] line-clamp-1">{fav.name}</div>
                  <div className="text-[10px] md:text-[11px] text-[#b0a59a] line-clamp-1">{getConfigSummary(fav)}</div>
                  <div className="text-[10px] text-[#c9bfb5]">{formatDateTime(fav.createdAt)}</div>
                  <button
                    type="button"
                    className="mt-1 w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold text-[#c67b5c] bg-[rgba(198,123,92,0.06)] border border-[rgba(198,123,92,0.12)] hover:bg-[rgba(198,123,92,0.1)] active:scale-95 transition-all"
                    onClick={() => handleApply(fav)}
                  >
                    <ArrowRight className="w-3 h-3" /> 发送
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══════════════ 上传素材对话框 ═══════════════ */}
      {uploadOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={closeUploadDialog}
        >
          <div
            className="w-full max-w-[460px] max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-white/60 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#c67b5c]" />
                <h3 className="text-[14px] font-semibold text-[#2d2422]">上传素材到素材库</h3>
              </div>
              <button
                type="button"
                onClick={closeUploadDialog}
                disabled={uploadSaving}
                className="text-[#b0a59a] hover:text-[#6f5f55] transition-colors disabled:opacity-40"
                aria-label="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 类型选择 */}
            <div className="mb-4">
              <div className="text-[11px] font-medium text-[#8b7355] mb-2">素材类型</div>
              <div className="grid grid-cols-3 gap-2">
                {UPLOAD_TYPES.map((t) => {
                  const Icon = t.icon
                  const active = uploadType === t.key
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setUploadType(t.key)}
                      disabled={uploadSaving}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all disabled:opacity-60"
                      style={{
                        borderColor: active ? t.accent : 'rgba(139,115,85,0.12)',
                        background: active ? t.bg : 'transparent',
                      }}
                    >
                      <span style={{ color: active ? t.accent : '#b0a59a' }}>
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="text-[12px] font-semibold" style={{ color: active ? t.accent : '#8b7355' }}>{t.label}</span>
                      <span className="text-[10px] text-[#b0a59a] leading-tight text-center">{t.desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 图片上传 */}
            <div className="mb-4">
              <div className="text-[11px] font-medium text-[#8b7355] mb-2">图片</div>
              <ImageUploader label="素材图" value={uploadImageUrl} onChange={setUploadImageUrl} />
            </div>

            {/* 名称输入 */}
            <div className="mb-5">
              <label className="block text-[11px] font-medium text-[#8b7355] mb-1.5">
                名称 <span className="text-[#c9bfb5]">（选填，留空自动命名）</span>
              </label>
              <input
                type="text"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value.slice(0, 40))}
                placeholder="起个好记的名字"
                disabled={uploadSaving}
                maxLength={40}
                className="w-full h-10 px-3 rounded-lg border border-[rgba(139,115,85,0.15)] bg-white text-[11px] font-bold text-[#2d2422] outline-none focus:border-[rgba(198,123,92,0.4)] focus:ring-2 focus:ring-[rgba(198,123,92,0.08)] disabled:opacity-60"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !uploadSaving && uploadImageUrl) {
                    void handleUploadSave()
                  }
                }}
              />
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeUploadDialog}
                disabled={uploadSaving}
                className="flex-1 h-10 rounded-lg border border-[rgba(139,115,85,0.15)] text-[13px] font-medium text-[#8b7355] hover:bg-[rgba(139,115,85,0.04)] transition-all disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => { void handleUploadSave() }}
                disabled={uploadSaving || !uploadImageUrl}
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-lg text-[13px] font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #c67b5c, #d4a882)' }}
              >
                {uploadSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {uploadSaving ? '保存中...' : '保存到素材库'}
              </button>
            </div>
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
            <p className="text-[13px] text-[#9b8e82] mb-5 leading-relaxed">删除后无法恢复，确定要删除这个收藏吗？</p>
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

      {/* 移动端悬浮上传按钮 */}
      <button
        type="button"
        onClick={() => openUploadDialog()}
        className="md:hidden fixed bottom-[64px] right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all"
        style={{
          background: 'linear-gradient(135deg, #c67b5c, #d4a882)',
          boxShadow: '0 4px 20px rgba(198,123,92,0.4)',
        }}
        aria-label="上传素材"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>
    </div>
  )
}
