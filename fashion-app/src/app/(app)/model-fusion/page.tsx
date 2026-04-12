'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ImageUploader } from '@/lib/components/common/ImageUploader'
import { workspaceApi } from '@/lib/api/workspace'
import { useAuthStore } from '@/lib/stores/authStore'
import { useDraftStore } from '@/lib/stores/draftStore'
import { useNotificationStore } from '@/lib/stores/notificationStore'
import { getErrorMessage } from '@/lib/utils/api'
import { Users, Download, Send, X, Sparkles } from 'lucide-react'

interface FusionResult {
  resultUrl: string
  modelUrls: string[]
}

export default function ModelFusionPage() {
  const router = useRouter()
  const fusionDraft = useDraftStore((state) => state.fusionDraft)
  const setFusionDraft = useDraftStore((state) => state.setFusionDraft)
  const clearFusionDraft = useDraftStore((state) => state.clearFusionDraft)
  const fusionResult = useDraftStore((state) => state.fusionResult)
  const setFusionResult = useDraftStore((state) => state.setFusionResult)
  const clearFusionResult = useDraftStore((state) => state.clearFusionResult)
  const setWorkspaceDraft = useDraftStore((state) => state.setWorkspaceDraft)

  const [model1, setModel1] = useState(fusionDraft?.model1 ?? '')
  const [model2, setModel2] = useState(fusionDraft?.model2 ?? '')
  const [model3, setModel3] = useState(fusionDraft?.model3 ?? '')
  const [resultUrl, setResultUrl] = useState(fusionResult?.resultUrl ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number } | null>(null)
  const updateCredits = useAuthStore((state) => state.updateCredits)
  const addNotification = useNotificationStore((state) => state.add)

  const stateRef = useRef({ model1, model2, model3 })
  stateRef.current = { model1, model2, model3 }

  // 自动保存草稿到内存 store
  useEffect(() => {
    setFusionDraft({ model1, model2, model3 })
  }, [model1, model2, model3, setFusionDraft])

  const canFuse = model1 || model2 || model3
  const modelCount = [model1, model2, model3].filter(Boolean).length

  const handleFuse = async () => {
    if (!canFuse) return
    setSubmitting(true)
    setError('')
    setResultUrl('')

    try {
      const urls = [model1, model2, model3].filter(Boolean)
      const data = await workspaceApi.fuseModels(urls)
      setResultUrl(data.resultUrl)
      setFusionResult({ resultUrl: data.resultUrl, modelUrls: urls })
      updateCredits(await workspaceApi.getBalance())
      clearFusionDraft()
      addNotification({ type: 'success', message: '模特合成完成！' })
    } catch (err) {
      setError(getErrorMessage(err, '模特合成失败'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownload = () => {
    if (!resultUrl) return
    const link = document.createElement('a')
    link.href = resultUrl
    link.download = `model-fusion-${Date.now()}.png`
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSendToWorkspace = () => {
    if (!resultUrl) return
    try {
      const existing = useDraftStore.getState().workspaceDraft
      setWorkspaceDraft({
        clothingUrl: existing?.clothingUrl ?? '',
        clothingBackUrl: existing?.clothingBackUrl ?? '',
        clothingDetailUrls: existing?.clothingDetailUrls ?? [],
        clothingLength: existing?.clothingLength,
        modelConfig: {
          ...(existing?.modelConfig || {}),
          mode: 'upload' as any,
          imageUrl: resultUrl,
        } as any,
        sceneConfig: existing?.sceneConfig ?? {
          mode: 'preset',
          sceneSource: 'preset',
          preset: 'city street（城市街道）',
          timeOfDay: 'noon（中午）',
          lighting: '全局光',
          composition: 'full-body（全身）',
          depthOfField: 'slight',
          aspectRatio: '3:4',
          prompt: '',
        },
        step: existing?.step ?? 1,
      })
      addNotification({ type: 'success', message: '已发送到工作台，正在跳转...' })
      router.push('/workspace')
    } catch {
      addNotification({ type: 'error', message: '发送到工作台失败' })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="hidden md:block">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">模特合成</h1>
        </div>
        <p className="text-gray-500 text-sm ml-[52px]">上传 1-3 张模特参考图，AI 将融合面部特征生成全新的模特半身像。</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium border border-red-100">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { label: 'A', value: model1, setter: setModel1 },
          { label: 'B', value: model2, setter: setModel2 },
          { label: 'C', value: model3, setter: setModel3 },
        ].map((item) => (
          <div key={item.label} className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="text-base font-semibold text-gray-800">模特 {item.label}</h3>
              <p className="text-[13px] text-gray-400 m-0">上传第{item.label === 'A' ? '一' : item.label === 'B' ? '二' : '三'}张模特参考图</p>
            </div>
            <ImageUploader label={`模特${item.label}`} value={item.value} onChange={item.setter} />
          </div>
        ))}
      </div>

      <div className="text-center mb-8">
        <button
          className="flex flex-col items-center justify-center max-w-[320px] w-full mx-auto py-5 px-8 bg-gradient-to-r from-[#c67b5c] via-[#d4a882] to-[#c67b5c] text-white border-none rounded-2xl text-lg font-bold cursor-pointer transition-all shadow-[0_4px_20px_rgba(198,123,92,0.35)] hover:shadow-[0_8px_32px_rgba(198,123,92,0.5)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
          type="button"
          onClick={() => { void handleFuse() }}
          disabled={!canFuse || submitting}
        >
          <div>{submitting ? '合成中...' : '合成模特'}</div>
          <div className="text-xs font-normal opacity-85 mt-1">消耗 1 积分 · 融合 {modelCount} 位模特</div>
        </button>
      </div>

      {resultUrl && (
        <div className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
          <div className="mb-5">
            <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" /> 合成结果
            </h3>
            <p className="text-[13px] text-gray-400 m-0">融合后的新模特半身像</p>
          </div>
          <div className="text-center">
            <img
              src={resultUrl}
              alt="合成结果"
              onClick={() => setPreviewSrc(resultUrl)}
              className="max-w-[260px] sm:max-w-[320px] max-h-[360px] sm:max-h-[420px] w-auto h-auto object-contain rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] cursor-pointer mx-auto hover:shadow-[0_8px_32px_rgba(0,0,0,0.18)] transition-all"
            />
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-3 mt-5">
            <button
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#c67b5c] to-[#d4a882] text-white border-none rounded-xl text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(198,123,92,0.3)] hover:shadow-[0_4px_16px_rgba(198,123,92,0.4)] hover:-translate-y-0.5 min-w-[140px]"
              type="button"
              onClick={handleDownload}
            >
              <Download className="w-4 h-4" /> 下载图片
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#b06a4d] to-[#c67b5c] text-white border-none rounded-xl text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(176,106,77,0.3)] hover:shadow-[0_4px_16px_rgba(176,106,77,0.4)] hover:-translate-y-0.5 min-w-[200px]"
              type="button"
              onClick={handleSendToWorkspace}
            >
              <Send className="w-4 h-4" /> 发送到工作台
            </button>
          </div>
        </div>
      )}

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
              onClick={() => { setPreviewSrc(null); setPreviewSize(null) }}
            >
              <X className="w-4 h-4" />
            </button>
            {/* 下载按钮 */}
            <button
              className="absolute -bottom-2 -right-2 w-9 h-9 bg-white shadow-lg text-[#c67b5c] border-none rounded-full flex items-center justify-center cursor-pointer hover:text-[#b0654a] active:scale-90 transition-all z-10"
              onClick={handleDownload}
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
