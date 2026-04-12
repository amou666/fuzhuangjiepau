'use client'

import { useState, useEffect } from 'react'
import { ImageUploader } from '@/lib/components/common/ImageUploader'
import { workspaceApi } from '@/lib/api/workspace'
import { useAuthStore } from '@/lib/stores/authStore'
import { useDraftStore, type RedesignMode } from '@/lib/stores/draftStore'
import { useNotificationStore } from '@/lib/stores/notificationStore'
import { getErrorMessage } from '@/lib/utils/api'
import {
  Palette, Layers, Shirt, Lightbulb, Download, Plus, X, Sparkles,
  Loader2, ImageIcon, Send,
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
  credits: number
  outputCount: string
  gradientFrom: string
  gradientTo: string
}[] = [
  {
    id: 'luxury-color',
    label: '奢侈品色系变色',
    icon: Palette,
    description: '探索高客单价奢侈品色系，100%保留面料细节，仅改变色相与饱和度',
    credits: 3,
    outputCount: '3',
    gradientFrom: '#c67b5c',
    gradientTo: '#d4a882',
  },
  {
    id: 'material-element',
    label: '材质感知加元素',
    icon: Layers,
    description: '识别面料属性，添加兼容工艺细节，轮廓100%保持一致',
    credits: 3,
    outputCount: '3',
    gradientFrom: '#b0654a',
    gradientTo: '#c67b5c',
  },
  {
    id: 'material-silhouette',
    label: '材质锁定改款式',
    icon: Shirt,
    description: 'AI识别材质与品类，同品类内改款设计，严格遵循品类规范，符合欧美审美趋势',
    credits: 3,
    outputCount: '3',
    gradientFrom: '#8b7355',
    gradientTo: '#b0654a',
  },
  {
    id: 'commercial-brainstorm',
    label: '商业脑暴模式',
    icon: Lightbulb,
    description: '完全释放AI创造力，生成符合欧美审美的流行款式，支持自定义Prompt',
    credits: 3,
    outputCount: '3',
    gradientFrom: '#d4967c',
    gradientTo: '#8b7355',
  },
]

export default function RedesignPage() {
  const router = useRouter()
  const redesignDraft = useDraftStore((state) => state.redesignDraft)
  const setRedesignDraft = useDraftStore((state) => state.setRedesignDraft)
  const redesignResult = useDraftStore((state) => state.redesignResult)
  const setRedesignResult = useDraftStore((state) => state.setRedesignResult)
  const clearRedesignResult = useDraftStore((state) => state.clearRedesignResult)
  const setWorkspaceDraft = useDraftStore((state) => state.setWorkspaceDraft)

  const [imageUrl, setImageUrl] = useState(redesignDraft?.imageUrl ?? '')
  const [mode, setMode] = useState<RedesignModeLocal>(redesignDraft?.mode ?? 'luxury-color')
  const [customPrompt, setCustomPrompt] = useState(redesignDraft?.customPrompt ?? '')
  const [resultUrls, setResultUrls] = useState<string[]>(redesignResult?.resultUrls ?? [])
  const [pendingCount, setPendingCount] = useState(0)
  const [generatedItems, setGeneratedItems] = useState<string[]>(redesignResult?.generatedItems ?? [])
  const [materialInfo, setMaterialInfo] = useState('')
  const [materialLoading, setMaterialLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number } | null>(null)
  const updateCredits = useAuthStore((state) => state.updateCredits)
  const addNotification = useNotificationStore((state) => state.add)

  // 自动保存草稿到内存 store
  useEffect(() => {
    setRedesignDraft({ imageUrl, mode, customPrompt })
  }, [imageUrl, mode, customPrompt, setRedesignDraft])

  // 上传图后自动识别材质
  useEffect(() => {
    if (!imageUrl) {
      setMaterialInfo('')
      return
    }
    setMaterialLoading(true)
    workspaceApi.recognizeMaterial(imageUrl).then(info => {
      setMaterialInfo(info)
    }).catch(() => {
      setMaterialInfo('')
    }).finally(() => {
      setMaterialLoading(false)
    })
  }, [imageUrl])

  const selectedMode = MODES.find(m => m.id === mode)!

  const handleGenerate = async () => {
    if (!imageUrl) return
    setSubmitting(true)
    setError('')
    setResultUrls([])
    setGeneratedItems([])
    clearRedesignResult()
    setPendingCount(3)
    setProgress('正在生成中...')

    try {
      const data = await workspaceApi.redesign(imageUrl, mode, mode === 'commercial-brainstorm' ? customPrompt : undefined, [])
      setResultUrls(data.resultUrls)
      setGeneratedItems(data.generatedItems || [])
      setRedesignResult({ resultUrls: data.resultUrls, generatedItems: data.generatedItems || [], imageUrl, mode })
      setPendingCount(0)
      updateCredits(await workspaceApi.getBalance())
      addNotification({ type: 'success', message: `改款完成！已生成 ${data.resultUrls.length} 张方案` })
    } catch (err) {
      setPendingCount(0)
      setError(getErrorMessage(err, '改款生成失败'))
    } finally {
      setSubmitting(false)
      setProgress('')
    }
  }

  const handleAppendMore = async () => {
    if (!imageUrl) return
    setSubmitting(true)
    setError('')
    setPendingCount(3)
    setProgress('追加方案中...')

    try {
      const data = await workspaceApi.redesign(imageUrl, mode, mode === 'commercial-brainstorm' ? customPrompt : undefined, generatedItems)
      const newUrls = [...resultUrls, ...data.resultUrls]
      const newItems = [...generatedItems, ...(data.generatedItems || [])]
      setResultUrls(newUrls)
      setGeneratedItems(newItems)
      setRedesignResult({ resultUrls: newUrls, generatedItems: newItems, imageUrl, mode })
      setPendingCount(0)
      updateCredits(await workspaceApi.getBalance())
      addNotification({ type: 'success', message: `已追加 ${data.resultUrls.length} 款方案` })
    } catch (err) {
      setPendingCount(0)
      setError(getErrorMessage(err, '追加方案失败'))
    } finally {
      setSubmitting(false)
      setProgress('')
    }
  }

  const handleDownload = (url: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = `redesign-${Date.now()}.png`
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSendToWorkspace = (url: string) => {
    try {
      setWorkspaceDraft({
        clothingUrl: url,
        clothingBackUrl: '',
        clothingDetailUrls: [],
        clothingLength: undefined,
        modelConfig: { mode: 'upload', imageUrl: '' } as any,
        sceneConfig: {
          mode: 'preset', sceneSource: 'preset', preset: 'city street（城市街道）',
          timeOfDay: 'noon（中午）', lighting: '全局光', composition: 'full-body（全身）',
          depthOfField: 'slight', aspectRatio: '3:4', prompt: '',
        },
        step: 1,
      })
      addNotification({ type: 'success', message: '已发送到工作台，正在跳转...' })
      router.push('/workspace')
    } catch {
      addNotification({ type: 'error', message: '发送到工作台失败' })
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* 页头 — Editorial Style */}
      <div className="hidden md:flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #c67b5c 0%, #d4a882 100%)' }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-[28px] font-bold tracking-tight text-[#2d2422]">AI 改款</h1>
          </div>
          <p className="text-[13px] text-[#9b8e82] ml-[52px] tracking-wide">上传服装原图，选择改款模式，AI 批量生成全新设计方案</p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[11px] text-[#b0a59a] tracking-widest uppercase">
          <span>消耗</span>
          <span className="text-[#c67b5c] font-bold text-sm">{selectedMode.credits}</span>
          <span>积分 / 次</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[#fef2f0] text-[#c47070] px-5 py-3.5 rounded-2xl text-sm font-medium border border-[#f0d5d0]">{error}</div>
      )}

      {/* 材质识别结果 */}
      {materialLoading && (
        <div className="fashion-glass rounded-2xl p-4 flex items-center gap-3">
          <Loader2 className="w-4 h-4 text-[#c67b5c] animate-spin" />
          <span className="text-[13px] text-[#9b8e82]">正在识别材质与款式...</span>
        </div>
      )}
      {materialInfo && !materialLoading && (
        <div className="fashion-glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <ImageIcon className="w-4 h-4 text-[#c67b5c]" />
            <span className="text-[13px] font-semibold text-[#2d2422]">材质与款式识别</span>
          </div>
          <p className="text-[12px] text-[#9b8e82] leading-relaxed">{materialInfo}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左侧：上传 + 模式选择 */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* 图片上传 */}
          <div className="fashion-glass rounded-2xl p-5">
            <h3 className="text-[15px] font-bold text-[#2d2422] tracking-tight mb-3">上传原图</h3>
            <ImageUploader label="服装原图" value={imageUrl} onChange={setImageUrl} />
          </div>

          {/* 模式选择 */}
          <div className="fashion-glass rounded-2xl p-5">
            <h3 className="text-[15px] font-bold text-[#2d2422] tracking-tight mb-3">选择模式</h3>
            <div className="flex flex-col gap-2">
              {MODES.map((m) => {
                const Icon = m.icon
                const isActive = mode === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className="text-left p-3.5 rounded-xl border transition-all duration-200"
                    style={{
                      background: isActive ? 'rgba(198,123,92,0.08)' : 'rgba(255,253,250,0.5)',
                      borderColor: isActive ? 'rgba(198,123,92,0.2)' : 'rgba(139,115,85,0.06)',
                      boxShadow: isActive ? '0 2px 8px rgba(198,123,92,0.1)' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `linear-gradient(135deg, ${m.gradientFrom} 0%, ${m.gradientTo} 100%)` }}
                      >
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span
                            className="text-[13px] font-semibold"
                            style={{ color: isActive ? '#b0654a' : '#2d2422' }}
                          >
                            {m.label}
                          </span>
                          <span className="text-[11px] text-[#b0a59a]">{m.credits} 积分 · {m.outputCount} 图</span>
                        </div>
                        <p className="text-[11px] text-[#b0a59a] mt-0.5 leading-relaxed line-clamp-2">{m.description}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 自定义 Prompt（商业脑暴模式） */}
          {mode === 'commercial-brainstorm' && (
            <div className="fashion-glass rounded-2xl p-5">
              <h3 className="text-[15px] font-bold text-[#2d2422] tracking-tight mb-2">创意方向</h3>
              <p className="text-[11px] text-[#b0a59a] mb-3">输入自定义 Prompt 作为核心权重引导生成</p>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="例：增加解构设计、工装风细节..."
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border bg-[rgba(255,253,250,0.7)] text-[13px] text-[#2d2422] placeholder:text-[#c9bfb5] focus:outline-none focus:ring-2 resize-none"
                style={{ borderColor: 'rgba(139,115,85,0.12)', '--tw-ring-color': 'rgba(198,123,92,0.15)' } as React.CSSProperties}
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
                <div className="text-[12px] font-normal opacity-85 mt-1">消耗 {selectedMode.credits} 积分 · 生成 {selectedMode.outputCount} 张方案</div>
              </>
            )}
          </button>
        </div>

        {/* 右侧：结果展示 */}
        <div className="lg:col-span-8">
          {resultUrls.length === 0 && pendingCount === 0 && (
            <div className="fashion-glass rounded-2xl p-12 text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(198,123,92,0.08)' }}
              >
                <Sparkles className="w-7 h-7 text-[#c67b5c]" style={{ opacity: 0.5 }} />
              </div>
              <h3 className="text-[15px] font-semibold text-[#b0a59a] mb-1">等待生成</h3>
              <p className="text-[13px] text-[#c9bfb5]">上传原图并选择模式后，点击生成按钮开始改款</p>
            </div>
          )}

          {(resultUrls.length > 0 || pendingCount > 0) && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-bold text-[#2d2422] tracking-tight flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#c67b5c]" />
                  生成结果
                  <span className="text-[13px] font-normal text-[#b0a59a]">({resultUrls.length} 张{pendingCount > 0 ? `，待生成 ${pendingCount} 张` : ''})</span>
                </h3>
                <button
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    color: '#b0654a',
                    background: 'rgba(198,123,92,0.06)',
                    border: '1px solid rgba(198,123,92,0.12)',
                  }}
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
                    <div className="relative rounded-xl overflow-hidden cursor-pointer" onClick={() => setPreviewSrc(url)}>
                      <img
                        src={url}
                        alt={`方案 ${idx + 1}`}
                        className="w-full aspect-[3/4] object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2.5 px-1">
                      <span className="text-[11px] font-medium text-[#9b8e82]">方案 {idx + 1}</span>
                      <div className="flex items-center gap-1">
                        <button
                          className="inline-flex items-center gap-1 p-1.5 rounded-lg hover:bg-[rgba(198,123,92,0.06)] text-[#b0a59a] hover:text-[#c67b5c] transition-colors text-[11px]"
                          onClick={() => handleSendToWorkspace(url)}
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">工作台</span>
                        </button>
                        <button
                          className="inline-flex items-center gap-1 p-1.5 rounded-lg hover:bg-[rgba(198,123,92,0.06)] text-[#b0a59a] hover:text-[#c67b5c] transition-colors text-[11px]"
                          onClick={() => handleDownload(url)}
                        >
                          <Download className="w-3.5 h-3.5" />
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
                      className="w-full aspect-[3/4] rounded-xl flex flex-col items-center justify-center gap-3"
                      style={{ background: 'linear-gradient(135deg, rgba(198,123,92,0.04) 0%, rgba(212,168,130,0.08) 100%)' }}
                    >
                      <div className="relative">
                        <div
                          className="w-10 h-10 rounded-full animate-spin"
                          style={{ border: '2px solid rgba(198,123,92,0.15)', borderTopColor: '#c67b5c' }}
                        />
                      </div>
                      <span className="text-[11px] font-medium text-[#c67b5c]" style={{ opacity: 0.6 }}>AI 创作中...</span>
                    </div>
                    <div className="flex items-center justify-between mt-2.5 px-1">
                      <span className="text-[11px] font-medium text-[#c9bfb5]">待生成</span>
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
              src={previewSrc}
              alt="放大预览"
              className="block w-full h-full object-contain"
              style={{ boxShadow: 'inset 0 0 20px rgba(0,0,0,0.03)' }}
              onLoad={(e) => {
                const img = e.currentTarget
                const naturalW = img.naturalWidth
                const naturalH = img.naturalHeight
                if (!naturalW || !naturalH) return
                const maxW = window.innerWidth * 0.92 - 20  // 减去左右 padding
                const maxH = window.innerHeight * 0.85 - 58 // 减去上下 padding + 底部文字区
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
              onClick={() => { setPreviewSrc(null); setPreviewSize(null) }}
            >
              <X className="w-4 h-4" />
            </button>
            {/* 下载按钮 */}
            <button
              className="absolute -bottom-2 -right-2 w-9 h-9 bg-white shadow-lg text-[#c67b5c] border-none rounded-full flex items-center justify-center cursor-pointer hover:text-[#b0654a] active:scale-90 transition-all z-10"
              onClick={() => handleDownload(previewSrc)}
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/40 rounded-full px-5 py-2 text-white/80 text-[12px] pointer-events-none sm:hidden">
            点击空白区域关闭
          </div>
        </div>
      )}
    </div>
  )
}
