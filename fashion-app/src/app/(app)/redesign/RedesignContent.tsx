'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ImageUploadPicker } from '@/lib/components/common/ImageUploadPicker'
import { workspaceApi } from '@/lib/api/workspace'
import { useAuthStore } from '@/lib/stores/authStore'
import { useDraftStore, type RedesignMode } from '@/lib/stores/draftStore'
import { useGenerationStore } from '@/lib/stores/generationStore'
import { useNotificationStore } from '@/lib/stores/notificationStore'
import { getErrorMessage } from '@/lib/utils/api'
import {
  Palette, Layers, Shirt, Lightbulb, Download, Plus, X, Sparkles,
  Loader2, ImageIcon, Send, GripVertical, Zap, RefreshCw,
} from 'lucide-react'
import { useRouter } from 'next/navigation'


type RedesignModeLocal = RedesignMode;

interface RedesignResult {
  resultUrls: string[]
  generatedItems: string[]
  imageUrl: string
  mode: RedesignModeLocal
}

const MODES: {
  id: RedesignModeLocal
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  outputCount: string
  gradientFrom: string
  gradientTo: string
  constraintPlaceholder: string
}[] = [
  {
    id: 'luxury-color',
    label: '奢侈品色系变色',
    icon: Palette,
    description: '探索高客单价奢侈品色系，100%保留面料细节，仅改变色相与饱和度',
    outputCount: '3',
    gradientFrom: '#c67b5c',
    gradientTo: '#d4a882',
    constraintPlaceholder: '例：只要暖色调、排除红色系、参考 Hermès 橙...',
  },
  {
    id: 'material-element',
    label: '材质感知加元素',
    icon: Layers,
    description: '识别面料属性，添加兼容工艺细节，轮廓100%保持一致',
    outputCount: '3',
    gradientFrom: '#b0654a',
    gradientTo: '#c67b5c',
    constraintPlaceholder: '例：只加金属配件、不要刺绣、保持极简风格...',
  },
  {
    id: 'material-silhouette',
    label: '改固定款式',
    icon: Shirt,
    description: 'AI识别材质与品类，同品类内改款设计，严格遵循品类规范，符合欧美审美趋势',
    outputCount: '3',
    gradientFrom: '#8b7355',
    gradientTo: '#b0654a',
    constraintPlaceholder: '例：领型不动、袖子改短袖、版型保持 H 型、2025 秋冬风格...',
  },
  {
    id: 'commercial-brainstorm',
    label: '商业脑暴模式',
    icon: Lightbulb,
    description: '完全释放AI创造力，生成符合欧美审美的流行款式，支持自定义Prompt',
    outputCount: '3',
    gradientFrom: '#d4967c',
    gradientTo: '#8b7355',
    constraintPlaceholder: '例：度假系列、价格带 200-300 元的简化版...',
  },
]

const COUNT_OPTIONS = [1, 3, 6]

function CompareSlider({ imgA, imgB }: { imgA: string; imgB: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(50)
  const dragging = useRef(false)

  const updatePos = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    setPos((x / rect.width) * 100)
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    updatePos(e.clientX)
  }, [updatePos])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    updatePos(e.clientX)
  }, [updatePos])

  const onPointerUp = useCallback(() => { dragging.current = false }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden cursor-col-resize select-none touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <img src={imgB} alt="改款" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        <img src={imgA} alt="原图" className="absolute inset-0 w-full h-full object-cover" style={{ minWidth: containerRef.current ? `${containerRef.current.offsetWidth}px` : '100%' }} draggable={false} />
      </div>
      <div className="absolute top-0 bottom-0 w-[3px] bg-[var(--bg-card)] shadow-lg z-10" style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 bg-[var(--bg-card)] rounded-full shadow-xl flex items-center justify-center">
          <GripVertical className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
        </div>
      </div>
      <div className="absolute top-2 left-2 bg-black/50 text-white text-xs font-bold px-2 py-0.5 rounded-full z-10">原图</div>
      <div className="absolute top-2 right-2 bg-[#c67b5c]/80 text-white text-xs font-bold px-2 py-0.5 rounded-full z-10">改款</div>
    </div>
  )
}

export default function RedesignContent() {
  const router = useRouter()
  const redesignDraft = useDraftStore((state) => state.redesignDraft)
  const setRedesignDraft = useDraftStore((state) => state.setRedesignDraft)
  const setRedesignResult = useDraftStore((state) => state.setRedesignResult)
  const clearRedesignResult = useDraftStore((state) => state.clearRedesignResult)
  const setQuickWorkspaceDraft = useDraftStore((state) => state.setQuickWorkspaceDraft)

  const [imageUrl, setImageUrl] = useState(redesignDraft?.imageUrl ?? '')
  const [mode, setMode] = useState<RedesignModeLocal>(redesignDraft?.mode ?? 'luxury-color')
  const [customPrompt, setCustomPrompt] = useState(redesignDraft?.customPrompt ?? '')
  const [constraints, setConstraints] = useState(redesignDraft?.constraints ?? '')
  const [count, setCount] = useState(redesignDraft?.count ?? 3)
  const [materialInfo, setMaterialInfo] = useState('')
  const [materialLoading, setMaterialLoading] = useState(false)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number } | null>(null)
  const [compareIdx, setCompareIdx] = useState<number | null>(null)
  const updateCredits = useAuthStore((state) => state.updateCredits)
  const addNotification = useNotificationStore((state) => state.add)

  const genState = useGenerationStore((s) => s.redesign)
  const setGen = useGenerationStore((s) => s.setRedesignGen)
  const { submitting, progress, resultUrls, pendingCount, generatedItems, error } = genState

  useEffect(() => {
    setRedesignDraft({ imageUrl, mode, customPrompt, constraints, count })
  }, [imageUrl, mode, customPrompt, constraints, count, setRedesignDraft])

  useEffect(() => {
    if (!imageUrl) { setMaterialInfo(''); return }
    setMaterialLoading(true)
    workspaceApi.recognizeMaterial(imageUrl).then(info => {
      setMaterialInfo(info)
    }).catch(() => { setMaterialInfo('') }).finally(() => { setMaterialLoading(false) })
  }, [imageUrl])

  const selectedMode = MODES.find(m => m.id === mode) ?? MODES[0]

  const handleGenerate = async (refineFrom?: string) => {
    if (!imageUrl) return
    setGen({ submitting: true, error: '' })
    const initialUrls = refineFrom ? [...resultUrls] : []
    const initialItems = refineFrom ? [...generatedItems] : []
    if (!refineFrom) {
      setGen({ resultUrls: [], generatedItems: [] })
      clearRedesignResult()
    }
    const totalCount = count
    setGen({ pendingCount: totalCount, progress: refineFrom ? `正在深化「${refineFrom.slice(0, 20)}」... (1/${totalCount})` : `正在生成第 1/${totalCount} 张...` })

    let currentUrls = initialUrls
    let currentItems = initialItems
    let successCount = 0

    for (let i = 0; i < totalCount; i++) {
      setGen({ progress: refineFrom ? `正在深化「${refineFrom.slice(0, 20)}」... (${i + 1}/${totalCount})` : `正在生成第 ${i + 1}/${totalCount} 张...` })
      try {
        const data = await workspaceApi.redesign(imageUrl, mode, {
          customPrompt: mode === 'commercial-brainstorm' ? customPrompt : undefined,
          excludedItems: i === 0 && !refineFrom ? generatedItems : [...initialItems, ...currentItems.slice(initialItems.length)],
          constraints: constraints || undefined,
          count: 1,
          refineFrom: refineFrom || undefined,
        })
        currentUrls = [...currentUrls, ...data.resultUrls]
        currentItems = [...currentItems, ...(data.generatedItems || [])]
        setGen({ resultUrls: [...currentUrls], generatedItems: [...currentItems] })
        setRedesignResult({ resultUrls: [...currentUrls], generatedItems: [...currentItems], imageUrl, mode })
        setGen({ pendingCount: totalCount - i - 1 })
        successCount += data.resultUrls.length
        updateCredits(data.credits)
      } catch (err) {
        // 单张失败不中断整体流程，继续生成下一张
        console.error(`改款第 ${i + 1} 张生成失败:`, err)
        setGen({ pendingCount: totalCount - i - 1 })
        if (i === 0 && !refineFrom) {
          // 第一张就失败，设置错误提示
          setGen({ error: getErrorMessage(err, '改款生成失败') })
        } else {
          // 非首张失败，用通知提醒用户
          addNotification({ type: 'info', message: `第 ${i + 1} 张生成失败，已跳过` })
        }
      }
    }

    setGen({ pendingCount: 0, submitting: false, progress: '' })
    // 无论成功/失败都同步积分（失败时后端会退还）
    updateCredits(await workspaceApi.getBalance())
    if (successCount > 0) {
      addNotification({ type: 'success', message: refineFrom ? `深化完成！追加了 ${successCount} 张方案` : `改款完成！已生成 ${successCount} 张方案` })
    }
  }

  const handleAppendMore = async () => {
    if (!imageUrl) return
    setGen({ submitting: true, error: '' })
    const totalCount = count
    setGen({ pendingCount: totalCount, progress: `追加方案中... (1/${totalCount})` })

    let currentUrls = [...resultUrls]
    let currentItems = [...generatedItems]
    let successCount = 0

    for (let i = 0; i < totalCount; i++) {
      setGen({ progress: `追加方案中... (${i + 1}/${totalCount})` })
      try {
        const data = await workspaceApi.redesign(imageUrl, mode, {
          customPrompt: mode === 'commercial-brainstorm' ? customPrompt : undefined,
          excludedItems: currentItems,
          constraints: constraints || undefined,
          count: 1,
        })
        currentUrls = [...currentUrls, ...data.resultUrls]
        currentItems = [...currentItems, ...(data.generatedItems || [])]
        setGen({ resultUrls: [...currentUrls], generatedItems: [...currentItems] })
        setRedesignResult({ resultUrls: [...currentUrls], generatedItems: [...currentItems], imageUrl, mode })
        setGen({ pendingCount: totalCount - i - 1 })
        successCount += data.resultUrls.length
        updateCredits(data.credits)
      } catch (err) {
        console.error(`追加第 ${i + 1} 张失败:`, err)
        setGen({ pendingCount: totalCount - i - 1 })
        if (i === 0) {
          setGen({ error: getErrorMessage(err, '追加方案失败') })
        } else {
          addNotification({ type: 'info', message: `追加第 ${i + 1} 张失败，已跳过` })
        }
      }
    }

    setGen({ pendingCount: 0, submitting: false, progress: '' })
    // 无论成功/失败都同步积分（失败时后端会退还）
    updateCredits(await workspaceApi.getBalance())
    if (successCount > 0) {
      addNotification({ type: 'success', message: `已追加 ${successCount} 款方案` })
    }
  }

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `redesign-${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(downloadUrl)
    } catch {
      window.open(url, '_blank')
    }
  }

  const handleSendToWorkspace = (url: string) => {
    try {
      const qw = useDraftStore.getState().qw
      const existing = useDraftStore.getState().quickWorkspaceDraft
      setQuickWorkspaceDraft({
        mode: existing?.mode ?? qw.mode ?? 'background',
        clothingUrl: url,
        clothingBackUrl: existing?.clothingBackUrl ?? qw.clothingBackUrl ?? '',
        modelImageUrl: existing?.modelImageUrl ?? qw.modelImageUrl ?? '',
        sceneImageUrl: existing?.sceneImageUrl ?? qw.sceneImageUrl ?? '',
        aspectRatio: existing?.aspectRatio ?? qw.aspectRatio ?? '3:4',
        framing: existing?.framing ?? qw.framing ?? 'auto',
        extraPrompt: existing?.extraPrompt ?? qw.extraPrompt ?? '',
        device: existing?.device ?? qw.device ?? 'phone',
      })
      addNotification({ type: 'success', message: '已发送到快速工作台，正在跳转...' })
      router.push('/quick-workspace')
    } catch {
      addNotification({ type: 'error', message: '发送到快速工作台失败' })
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="md:hidden flex items-center gap-2.5 -mb-4">
        <div
          className="hidden w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #c67b5c 0%, #d4a882 100%)' }}
        >
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <h1 className="hidden text-lg font-bold tracking-tight text-[var(--text-primary)] flex-1">AI 改款</h1>
      </div>
      {/* 页头 - 桌面端带积分信息 */}
      <div className="hidden md:flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #c67b5c 0%, #d4a882 100%)' }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">AI 改款</h1>
          </div>
          <p className="text-sm text-[var(--text-tertiary)] ml-[52px] tracking-wide">上传服装原图，选择改款模式，AI 批量生成全新设计方案</p>
        </div>
        <div className="hidden md:flex items-center gap-3 text-xs text-[var(--text-quaternary)] tracking-widest uppercase">
          <span>消耗</span>
          <span className="text-[#c67b5c] font-bold text-sm">{count}</span>
          <span>积分 / 次 · {count} 图</span>
        </div>
      </div>

      {error && (
        <div className="bg-[rgba(196,112,112,0.08)] text-[#c47070] px-5 py-3.5 rounded-2xl text-sm font-medium border border-[rgba(196,112,112,0.2)]">{error}</div>
      )}

      {/* 材质识别 */}
      {materialLoading && (
        <div className="fashion-glass rounded-2xl p-4 flex items-center gap-3">
          <Loader2 className="w-4 h-4 text-[#c67b5c] animate-spin" />
          <span className="text-sm text-[var(--text-tertiary)]">正在识别材质与款式...</span>
        </div>
      )}
      {materialInfo && !materialLoading && (
        <div className="fashion-glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <ImageIcon className="w-4 h-4 text-[#c67b5c]" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">材质与款式识别</span>
          </div>
          <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">{materialInfo}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左侧 */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* 图片上传 */}
          <div className="fashion-glass rounded-2xl p-5">
            <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight mb-3">上传原图</h3>
            <ImageUploadPicker label="服装原图" value={imageUrl} onChange={setImageUrl} sourceType="clothing" helperText="服装正面清晰图，支持从素材库快速选择" />
          </div>

          {/* 模式选择 */}
          <div className="fashion-glass rounded-2xl p-5">
            <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight mb-3">选择模式</h3>
            <div className="flex flex-col gap-2">
              {MODES.map((m) => {
                const Icon = m.icon
                const isActive = mode === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className="text-left p-3.5 rounded-2xl border transition-all duration-200"
                    style={{
                      background: isActive ? 'var(--bg-active)' : 'var(--bg-muted)',
                      borderColor: isActive ? 'rgba(198,123,92,0.2)' : 'rgba(139,115,85,0.06)',
                      boxShadow: isActive ? '0 2px 8px rgba(198,123,92,0.1)' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ background: `linear-gradient(135deg, ${m.gradientFrom} 0%, ${m.gradientTo} 100%)` }}
                      >
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold" style={{ color: isActive ? '#b0654a' : 'var(--text-primary)' }}>
                            {m.label}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-quaternary)] mt-0.5 leading-relaxed line-clamp-2">{m.description}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 生成数量 */}
          <div className="fashion-glass rounded-2xl p-5">
            <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight mb-2">生成数量</h3>
            <p className="text-xs text-[var(--text-quaternary)] mb-3">每张消耗 1 积分</p>
            <div className="flex gap-2">
              {COUNT_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCount(c)}
                  className="flex-1 py-2.5 rounded-2xl border text-center transition-all font-semibold"
                  style={{
                    background: count === c ? 'linear-gradient(135deg, #c67b5c, #d4a882)' : 'var(--bg-muted)',
                    color: count === c ? '#fff' : 'var(--text-secondary)',
                    borderColor: count === c ? 'transparent' : 'rgba(139,115,85,0.1)',
                    boxShadow: count === c ? '0 2px 8px rgba(198,123,92,0.2)' : 'none',
                  }}
                >
                  <div className="text-sm">{c}</div>
                  <div className="text-xs" style={{ opacity: 0.8 }}>{c} 积分</div>
                </button>
              ))}
            </div>
          </div>

          {/* 设计约束（所有模式通用） */}
          <div className="fashion-glass rounded-2xl p-5">
            <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight mb-2">设计约束</h3>
            <p className="text-xs text-[var(--text-quaternary)] mb-3">告诉 AI 要保留什么、不要什么、方向偏好（选填）</p>
            <textarea
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              placeholder={selectedMode.constraintPlaceholder}
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-2xl border bg-[var(--bg-card)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-extreme)] focus:outline-none focus:ring-2 resize-none"
              style={{ borderColor: 'var(--border-normal)', '--tw-ring-color': 'rgba(198,123,92,0.15)' } as React.CSSProperties}
            />
          </div>

          {/* 自定义 Prompt（商业脑暴模式） */}
          {mode === 'commercial-brainstorm' && (
            <div className="fashion-glass rounded-2xl p-5">
              <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight mb-2">创意方向</h3>
              <p className="text-xs text-[var(--text-quaternary)] mb-3">输入自定义 Prompt 作为核心权重引导生成</p>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="例：增加解构设计、工装风细节..."
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-2xl border bg-[var(--bg-card)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-extreme)] focus:outline-none focus:ring-2 resize-none"
                style={{ borderColor: 'var(--border-normal)', '--tw-ring-color': 'rgba(198,123,92,0.15)' } as React.CSSProperties}
              />
            </div>
          )}

          {/* 生成按钮 */}
          <button
            className="flex flex-col items-center justify-center w-full py-5 px-8 text-white border-none rounded-2xl text-lg font-bold cursor-pointer transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            style={{
              background: 'linear-gradient(135deg, #c67b5c 0%, #d4a882 100%)',
              boxShadow: '0 4px 20px rgba(198,123,92,0.35)',
            }}
            type="button"
            onClick={() => { void handleGenerate() }}
            disabled={!imageUrl || submitting}
          >
            {submitting ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{progress || '生成中...'}</span>
              </div>
            ) : (
              <>
                <div>开始改款</div>
                <div className="text-xs font-normal opacity-85 mt-1">消耗 {count} 积分 · 生成 {count} 张方案</div>
              </>
            )}
          </button>
        </div>

        {/* 右侧：结果展示 */}
        <div className="lg:col-span-8">
          {resultUrls.length === 0 && pendingCount === 0 && (
            <div className="fashion-glass rounded-2xl p-8 md:p-12 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--bg-active)' }}>
                <Sparkles className="w-7 h-7 text-[#c67b5c]" style={{ opacity: 0.5 }} />
              </div>
              <h3 className="text-base font-semibold text-[var(--text-quaternary)] mb-1">等待生成</h3>
              <p className="text-sm text-[var(--text-extreme)]">上传原图并选择模式后，点击生成按钮开始改款</p>
            </div>
          )}

          {(resultUrls.length > 0 || pendingCount > 0) && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#c67b5c]" />
                  生成结果
                  <span className="text-sm font-normal text-[var(--text-quaternary)]">({resultUrls.length} 张{pendingCount > 0 ? `，待生成 ${pendingCount} 张` : ''})</span>
                </h3>
                <button
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ color: '#b0654a', background: 'var(--bg-active)', border: '1px solid rgba(198,123,92,0.12)' }}
                  type="button"
                  onClick={() => { void handleAppendMore() }}
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  追加方案
                </button>
              </div>

              <div className={
                (resultUrls.length + pendingCount) <= 3
                  ? 'grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4'
                  : (resultUrls.length + pendingCount) <= 6
                  ? 'grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4'
                  : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4'
              }>
                {resultUrls.map((url, idx) => (
                  <div
                    key={`result-${idx}`}
                    className="group fashion-glass rounded-2xl p-3 hover:shadow-[0_4px_16px_rgba(198,123,92,0.12)] transition-all"
                  >
                    {/* 对比模式 vs 普通预览 */}
                    {compareIdx === idx && imageUrl ? (
                      <CompareSlider imgA={imageUrl} imgB={url} />
                    ) : (
                      <div className="relative rounded-2xl overflow-hidden cursor-pointer" onClick={() => setPreviewSrc(url)}>
                        <img
                          src={url}
                          alt={`方案 ${idx + 1}`}
                          className="w-full aspect-[3/4] object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                        {/* 原图缩略图角标 */}
                        {imageUrl && (
                          <div className="absolute bottom-1.5 left-1.5 w-10 h-10 rounded-2xl overflow-hidden border-2 border-white/80 shadow-md opacity-70 group-hover:opacity-100 transition-opacity z-10">
                            <img src={imageUrl} alt="原图" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5 mt-2.5 px-1">
                      {/* 方案名称 */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-[var(--text-tertiary)] truncate flex-1 mr-2" title={generatedItems[idx]}>
                          {generatedItems[idx] ? `方案 ${idx + 1}: ${generatedItems[idx]}` : `方案 ${idx + 1}`}
                        </span>
                      </div>
                      {/* 操作按钮 */}
                      <div className="flex items-center gap-0.5 flex-wrap">
                        <button
                          className="inline-flex items-center gap-0.5 p-1.5 rounded-2xl hover:bg-[var(--bg-active)] text-[var(--text-quaternary)] hover:text-[#c67b5c] transition-colors text-xs"
                          onClick={() => setCompareIdx(compareIdx === idx ? null : idx)}
                          title="与原图对比"
                        >
                          <GripVertical className="w-3 h-3" />
                          <span className="hidden sm:inline">{compareIdx === idx ? '关闭' : '对比'}</span>
                        </button>
                        <button
                          className="inline-flex items-center gap-0.5 p-1.5 rounded-2xl hover:bg-[var(--bg-active)] text-[var(--text-quaternary)] hover:text-[#c67b5c] transition-colors text-xs"
                          onClick={() => { void handleGenerate(generatedItems[idx] || `方案 ${idx + 1}`) }}
                          disabled={submitting}
                          title="基于这个方向深化"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span className="hidden sm:inline">深化</span>
                        </button>
                        <button
                          className="inline-flex items-center gap-0.5 p-1.5 rounded-2xl hover:bg-[var(--bg-active)] text-[var(--text-quaternary)] hover:text-[#c67b5c] transition-colors text-xs"
                          onClick={() => handleSendToWorkspace(url)}
                        >
                          <Send className="w-3 h-3" />
                          <span className="hidden sm:inline">快速工作台</span>
                        </button>
                        <button
                          className="inline-flex items-center gap-0.5 p-1.5 rounded-2xl hover:bg-[var(--bg-active)] text-[var(--text-quaternary)] hover:text-[#c67b5c] transition-colors text-xs"
                          onClick={() => handleDownload(url)}
                        >
                          <Download className="w-3 h-3" />
                          <span className="hidden sm:inline">下载</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {Array.from({ length: pendingCount }).map((_, idx) => (
                  <div
                    key={`pending-${idx}`}
                    className="fashion-glass rounded-2xl p-3"
                    style={{ borderStyle: 'dashed', borderColor: 'rgba(198,123,92,0.2)' }}
                  >
                    <div
                      className="w-full aspect-[3/4] rounded-2xl flex flex-col items-center justify-center gap-3"
                      style={{ background: 'linear-gradient(135deg, rgba(198,123,92,0.04) 0%, rgba(212,168,130,0.08) 100%)' }}
                    >
                      <div className="relative">
                        <div
                          className="w-10 h-10 rounded-full animate-spin"
                          style={{ border: '2px solid rgba(198,123,92,0.15)', borderTopColor: '#c67b5c' }}
                        />
                      </div>
                      <span className="text-xs font-medium text-[#c67b5c]" style={{ opacity: 0.6 }}>AI 创作中...</span>
                    </div>
                    <div className="flex items-center justify-between mt-2.5 px-1">
                      <span className="text-xs font-medium text-[var(--text-extreme)]">待生成</span>
                      <div className="w-5 h-5" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 图片预览弹窗 */}
      {previewSrc && (
        <div
          onClick={() => { setPreviewSrc(null); setPreviewSize(null) }}
          className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-[9999] cursor-pointer"
        >
          <div
            className="relative bg-[var(--bg-card)] rounded-sm shadow-[0_8px_40px_rgba(0,0,0,0.45),0_2px_8px_rgba(0,0,0,0.2)] cursor-default"
            style={{
              padding: '14px 14px 56px 14px',
              transform: 'rotate(-1.5deg)',
              ...(previewSize ? { width: `${previewSize.width}px`, height: `${previewSize.height}px` } : {}),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewSrc}
              alt="放大预览"
              className="block w-full h-full object-contain"
              style={{ boxShadow: 'inset 0 0 20px rgba(0,0,0,0.03)' }}
              onLoad={(e) => {
                const img = e.currentTarget
                const naturalW = img.naturalWidth
                const naturalH = img.naturalHeight
                if (!naturalW || !naturalH) return
                const padX = 28
                const padY = 70
                const maxW = window.innerWidth * 0.92 - padX
                const maxH = window.innerHeight * 0.85 - padY
                const scale = Math.min(maxW / naturalW, maxH / naturalH, 1)
                setPreviewSize({ width: Math.round(naturalW * scale) + padX, height: Math.round(naturalH * scale) + padY })
              }}
            />
            <div className="absolute bottom-2 left-0 right-0 flex justify-center">
              <span className="text-xs text-[#999] font-light tracking-wider" style={{ fontFamily: 'Georgia, serif' }}>这个款真好看！！！</span>
            </div>
            <button
              className="absolute -top-2 -right-2 w-8 h-8 bg-[var(--bg-card)] shadow-lg text-[#666] border-none rounded-full flex items-center justify-center cursor-pointer hover:text-[#333] active:scale-90 transition-all z-10"
              onClick={() => { setPreviewSrc(null); setPreviewSize(null) }}
            >
              <X className="w-4 h-4" />
            </button>
            <button
              className="absolute -bottom-2 -right-2 w-9 h-9 bg-[var(--bg-card)] shadow-lg text-[#c67b5c] border-none rounded-full flex items-center justify-center cursor-pointer hover:text-[#b0654a] active:scale-90 transition-all z-10"
              onClick={() => handleDownload(previewSrc)}
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/40 rounded-full px-5 py-2 text-white/80 text-xs pointer-events-none sm:hidden">
            点击空白区域关闭
          </div>
        </div>
      )}
    </div>
  )
}
