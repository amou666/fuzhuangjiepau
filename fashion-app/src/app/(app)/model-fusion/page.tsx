'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ImageUploader } from '@/lib/components/common/ImageUploader'
import { workspaceApi } from '@/lib/api/workspace'
import { useAuthStore } from '@/lib/stores/authStore'
import { useDraftStore } from '@/lib/stores/draftStore'
import { useNotificationStore } from '@/lib/stores/notificationStore'
import { getErrorMessage } from '@/lib/utils/api'
import { Users, Download, Send, X, Sparkles, Sliders, Blend, Crown, Shuffle, Settings2 } from 'lucide-react'
import { TutorialButton } from '@/lib/components/common/TutorialModal'
import { TUTORIALS } from '@/lib/tutorials'
import type { ModelConfig } from '@/lib/types'
import { categoryOptions, ageOptions, ethnicityOptions, genderOptions, skinOptions, bodyOptions, heightOptions, faceShapeOptions, hairStyleOptions, hairColorOptions, faceFeatureOptions, expressionOptions } from '@/lib/model-options'

type PageTab = 'fusion' | 'generate'
type FusionStrategy = 'balanced' | 'feature-pick' | 'dominant'

const STRATEGIES: { key: FusionStrategy; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'balanced', label: '均衡融合', desc: '每张脸平均贡献', icon: Blend },
  { key: 'feature-pick', label: '最优特征', desc: '取每人最佳五官', icon: Crown },
  { key: 'dominant', label: '主导融合', desc: '以高权重为主体', icon: Shuffle },
]

const selectStyle: React.CSSProperties = {
  background: 'rgba(139,115,85,0.03)',
  border: '1px solid rgba(139,115,85,0.1)',
  borderRadius: '12px',
  padding: '10px 36px 10px 14px',
  fontSize: '13px',
  color: '#2d2422',
  width: '100%',
  outline: 'none',
  transition: 'all 0.2s',
}

const DEFAULT_MODEL_CONFIG: ModelConfig = {
  mode: 'generate',
  category: 'normal',
  age: '25',
  ethnicity: 'Chinese',
  gender: 'female',
  skinTone: 'natural',
  bodyType: 'slim',
  height: '',
  faceShape: '',
  hairStyle: '',
  hairColor: 'black',
  faceFeature: '',
  pose: '',
  expression: '',
}

export default function ModelFusionPage() {
  const router = useRouter()
  const fusionDraft = useDraftStore((state) => state.fusionDraft)
  const setFusionDraft = useDraftStore((state) => state.setFusionDraft)
  const clearFusionDraft = useDraftStore((state) => state.clearFusionDraft)
  const fusionResult = useDraftStore((state) => state.fusionResult)
  const setFusionResult = useDraftStore((state) => state.setFusionResult)
  const setWorkspaceDraft = useDraftStore((state) => state.setWorkspaceDraft)
  const updateCredits = useAuthStore((state) => state.updateCredits)
  const addNotification = useNotificationStore((state) => state.add)

  // ─── 页面 Tab ───
  const [tab, setTab] = useState<PageTab>('generate')

  // ─── 共享状态 ───
  const [resultUrl, setResultUrl] = useState(fusionResult?.resultUrl ?? '')
  const [resultUrls, setResultUrls] = useState<string[]>(fusionResult?.resultUrl ? [fusionResult.resultUrl] : [])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number } | null>(null)

  // ─── 融合模式状态 ───
  const [model1, setModel1] = useState(fusionDraft?.model1 ?? '')
  const [model2, setModel2] = useState(fusionDraft?.model2 ?? '')
  const [model3, setModel3] = useState(fusionDraft?.model3 ?? '')
  const [weights, setWeights] = useState<[number, number, number]>([50, 50, 50])
  const [strategy, setStrategy] = useState<FusionStrategy>('balanced')

  // ─── 参数生成模式状态 ───
  const [genConfig, setGenConfig] = useState<ModelConfig>(DEFAULT_MODEL_CONFIG)
  const [referenceUrl, setReferenceUrl] = useState('')

  useEffect(() => {
    setFusionDraft({ model1, model2, model3 })
  }, [model1, model2, model3, setFusionDraft])

  const models = [model1, model2, model3]
  const activeIndices = models.map((m, i) => m ? i : -1).filter(i => i >= 0)
  const canFuse = activeIndices.length > 0
  const modelCount = activeIndices.length

  const updateWeight = (index: number, value: number) => {
    setWeights(prev => {
      const next = [...prev] as [number, number, number]
      next[index] = value
      return next
    })
  }

  const updateGenConfig = (patch: Partial<ModelConfig>) => {
    setGenConfig(prev => ({ ...prev, ...patch }))
  }

  // ─── 融合模式提交 ───
  const handleFuse = async () => {
    if (!canFuse) return
    setSubmitting(true)
    setError('')
    setResultUrl('')
    setResultUrls([])
    try {
      const urls = activeIndices.map(i => models[i])
      const activeWeights = activeIndices.map(i => weights[i])
      const data = await workspaceApi.fuseModels(urls, { weights: activeWeights, strategy })
      setResultUrl(data.resultUrl)
      setResultUrls([data.resultUrl])
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

  // ─── 参数生成提交 ───
  const handleGenerate = async () => {
    setSubmitting(true)
    setError('')
    setResultUrl('')
    setResultUrls([])
    try {
      const data = await workspaceApi.generateModelPortrait(
        genConfig as unknown as Record<string, unknown>,
        referenceUrl || undefined
      )
      if (!data.resultUrls?.length) {
        setError('AI 未返回生成结果，请重试')
        return
      }
      setResultUrl(data.resultUrls[0])
      setResultUrls(data.resultUrls)
      setFusionResult({ resultUrl: data.resultUrls[0], modelUrls: [] })
      updateCredits(await workspaceApi.getBalance())
      addNotification({ type: 'success', message: '模特生成完成！' })
    } catch (err) {
      setError(getErrorMessage(err, '参数生成模特失败'))
    } finally {
      setSubmitting(false)
    }
  }

  // ─── 下载 ───
  const handleDownload = (url?: string) => {
    const src = url || resultUrl
    if (!src) return
    const link = document.createElement('a')
    link.href = src
    link.download = `model-${tab}-${Date.now()}.png`
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ─── 发送到工作台（支持指定 url） ───
  const handleSendToWorkspace = (url?: string) => {
    const src = url || resultUrl
    if (!src) return
    try {
      const existing = useDraftStore.getState().workspaceDraft
      setWorkspaceDraft({
        clothingUrl: existing?.clothingUrl ?? '',
        clothingBackUrl: existing?.clothingBackUrl ?? '',
        clothingDetailUrls: existing?.clothingDetailUrls ?? [],
        clothingLength: existing?.clothingLength,
        modelConfig: {
          ...(existing?.modelConfig || {}),
          ...(tab === 'generate' ? genConfig : {}),
          mode: 'upload' as const,
          imageUrl: src,
        } as ModelConfig,
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
      {/* Mobile tutorial */}
      <div className="flex justify-end md:hidden -mb-2">
        <TutorialButton id="model-fusion" steps={TUTORIALS['model-fusion']} />
      </div>

      {/* Desktop header */}
      <div className="hidden md:block">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">模特工厂</h1>
          <div className="ml-auto"><TutorialButton id="model-fusion" steps={TUTORIALS['model-fusion']} /></div>
        </div>
        <p className="text-gray-500 text-sm ml-[52px]">通过参数描述或多张参考图，生成全新的 AI 模特形象</p>
      </div>

      {/* ─── 顶部 Tab 切换 ─── */}
      <div className="flex gap-2 p-1 rounded-2xl" style={{ background: 'rgba(139,115,85,0.04)', border: '1px solid rgba(139,115,85,0.06)' }}>
        {([
          { key: 'generate' as PageTab, label: '参数生成', icon: Settings2, desc: '按参数描述生成模特' },
          { key: 'fusion' as PageTab, label: '图片融合', icon: Blend, desc: '多张参考图融合模特' },
        ]).map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => { setTab(t.key); setError('') }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[13px] font-semibold transition-all"
              style={{
                background: active ? 'white' : 'transparent',
                color: active ? '#c67b5c' : '#8b7355',
                boxShadow: active ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              <span className="hidden sm:inline text-[11px] font-normal opacity-60">· {t.desc}</span>
            </button>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium border border-red-100">{error}</div>
      )}

      {/* ═══════════════ 参数生成模式 ═══════════════ */}
      {tab === 'generate' && (
        <>
          {/* 基础属性 */}
          <div className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="text-[15px] font-bold text-[#2d2422]">基础属性</h3>
              <p className="text-[12px] text-[#9b8e82] mt-1">决定模特的整体气质方向</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-5">
              <SelectField label="风格类别" value={genConfig.category} options={categoryOptions} onChange={v => updateGenConfig({ category: v })} hint="决定整体气质和造型风格" />
              <SelectField label="性别" value={genConfig.gender} options={genderOptions} onChange={v => updateGenConfig({ gender: v })} />
              <SelectField label="年龄" value={genConfig.age} options={ageOptions} onChange={v => updateGenConfig({ age: v })} />
              <SelectField label="人种" value={genConfig.ethnicity} options={ethnicityOptions} onChange={v => updateGenConfig({ ethnicity: v })} />
            </div>
          </div>

          {/* 身体特征 */}
          <div className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="text-[15px] font-bold text-[#2d2422]">身体特征</h3>
              <p className="text-[12px] text-[#9b8e82] mt-1">肤色、体型、身高等身体属性</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-5">
              <SelectField label="肤色" value={genConfig.skinTone} options={skinOptions} onChange={v => updateGenConfig({ skinTone: v })} />
              <SelectField label="体型" value={genConfig.bodyType} options={bodyOptions} onChange={v => updateGenConfig({ bodyType: v })} />
              <SelectField label="身高" value={genConfig.height ?? ''} options={heightOptions} onChange={v => updateGenConfig({ height: v })} />
            </div>
          </div>

          {/* 面部与发型 */}
          <div className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="text-[15px] font-bold text-[#2d2422]">面部与发型</h3>
              <p className="text-[12px] text-[#9b8e82] mt-1">脸型、发型、发色、妆容等精细控制</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-5">
              <SelectField label="脸型" value={genConfig.faceShape ?? ''} options={faceShapeOptions} onChange={v => updateGenConfig({ faceShape: v })} />
              <SelectField label="发型" value={genConfig.hairStyle ?? ''} options={hairStyleOptions} onChange={v => updateGenConfig({ hairStyle: v })} />
              <SelectField label="发色" value={genConfig.hairColor ?? ''} options={hairColorOptions} onChange={v => updateGenConfig({ hairColor: v })} />
              <SelectField label="妆造 / 面部细节" value={genConfig.faceFeature} options={faceFeatureOptions} onChange={v => updateGenConfig({ faceFeature: v })} hint="妆容风格、雀斑酒窝等特征" />
              <SelectField label="表情" value={genConfig.expression || ''} options={expressionOptions} onChange={v => updateGenConfig({ expression: v })} />
            </div>
          </div>

          {/* 参考图（可选） */}
          <div className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="text-[15px] font-bold text-[#2d2422]">面部参考图 <span className="text-[12px] font-normal text-[#b0a59a]">（可选）</span></h3>
              <p className="text-[12px] text-[#9b8e82] mt-1">上传一张人脸照片，AI 会参考该面部特征来生成模特，使结果更贴近你想要的长相</p>
            </div>
            <ImageUploader label="面部参考" value={referenceUrl} onChange={setReferenceUrl} />
          </div>

          {/* 生成按钮 */}
          <div className="text-center mb-4">
            <button
              className="flex flex-col items-center justify-center max-w-[320px] w-full mx-auto py-5 px-8 bg-gradient-to-r from-[#c67b5c] via-[#d4a882] to-[#c67b5c] text-white border-none rounded-2xl text-lg font-bold cursor-pointer transition-all shadow-[0_4px_20px_rgba(198,123,92,0.35)] hover:shadow-[0_8px_32px_rgba(198,123,92,0.5)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
              type="button"
              onClick={() => { void handleGenerate() }}
              disabled={submitting}
            >
              <div>{submitting ? '生成中...' : '生成模特'}</div>
              <div className="text-xs font-normal opacity-85 mt-1">消耗 1 积分 · AI 生成全新模特</div>
            </button>
          </div>
        </>
      )}

      {/* ═══════════════ 图片融合模式 ═══════════════ */}
      {tab === 'fusion' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {([
              { label: 'A', value: model1, setter: setModel1, idx: 0 },
              { label: 'B', value: model2, setter: setModel2, idx: 1 },
              { label: 'C', value: model3, setter: setModel3, idx: 2 },
            ] as const).map((item) => (
              <div key={item.label} className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
                <div className="mb-5">
                  <h3 className="text-base font-semibold text-gray-800">模特 {item.label}</h3>
                  <p className="text-[13px] text-gray-400 m-0">上传第{item.label === 'A' ? '一' : item.label === 'B' ? '二' : '三'}张模特参考图</p>
                </div>
                <ImageUploader label={`模特${item.label}`} value={item.value} onChange={item.setter} />
                {item.value && modelCount > 1 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-[#9b8e82] font-medium tracking-wide">权重</span>
                      <span className="text-[12px] font-bold text-[#c67b5c] tabular-nums">{weights[item.idx]}%</span>
                    </div>
                    <input
                      type="range" min={10} max={90} step={5}
                      value={weights[item.idx]}
                      onChange={e => updateWeight(item.idx, Number(e.target.value))}
                      className="w-full h-1.5 appearance-none rounded-full bg-[rgba(139,115,85,0.1)] outline-none cursor-pointer accent-[#c67b5c]"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {modelCount > 1 && (
            <div className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Sliders className="w-4 h-4 text-[#c67b5c]" />
                <h3 className="text-sm font-semibold text-[#2d2422]">融合策略</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {STRATEGIES.map(s => {
                  const Icon = s.icon
                  const isActive = strategy === s.key
                  return (
                    <button
                      key={s.key} type="button"
                      onClick={() => setStrategy(s.key)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all border"
                      style={{
                        background: isActive ? 'rgba(198,123,92,0.06)' : 'transparent',
                        borderColor: isActive ? 'rgba(198,123,92,0.3)' : 'rgba(139,115,85,0.08)',
                      }}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: isActive ? 'linear-gradient(135deg, #c67b5c, #d4a882)' : 'rgba(139,115,85,0.06)' }}>
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#b0a59a]'}`} />
                      </div>
                      <div>
                        <div className={`text-[13px] font-semibold ${isActive ? 'text-[#c67b5c]' : 'text-[#6b5d4f]'}`}>{s.label}</div>
                        <div className="text-[11px] text-[#b0a59a]">{s.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="text-center mb-4">
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
        </>
      )}

      {/* ═══════════════ 结果展示（两种模式共用） ═══════════════ */}
      {resultUrls.length > 0 && (
        <div className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
          <div className="mb-5">
            <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              {tab === 'generate' ? '生成结果' : '合成结果'}
            </h3>
            <p className="text-[13px] text-gray-400 m-0">
              {tab === 'generate' ? 'AI 根据参数生成的全新模特' : '融合后的新模特半身像'}
            </p>
          </div>

          <div className={`flex flex-wrap justify-center gap-4 ${resultUrls.length > 1 ? '' : ''}`}>
            {resultUrls.map((url, i) => (
              <div key={i} className="flex flex-col items-center gap-3">
                <img
                  src={url}
                  alt={`结果 ${i + 1}`}
                  onClick={() => setPreviewSrc(url)}
                  className="max-w-[260px] sm:max-w-[300px] max-h-[360px] sm:max-h-[400px] w-auto h-auto object-contain rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] cursor-pointer hover:shadow-[0_8px_32px_rgba(0,0,0,0.18)] transition-all"
                />
                <div className="flex gap-2">
                  <button
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#8b7355] transition-all"
                    style={{ background: 'rgba(139,115,85,0.04)', border: '1px solid rgba(139,115,85,0.1)' }}
                    type="button"
                    onClick={() => handleDownload(url)}
                  >
                    <Download className="w-3.5 h-3.5" /> 下载
                  </button>
                  <button
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-all"
                    style={{ background: 'linear-gradient(135deg, #c67b5c, #d4a882)' }}
                    type="button"
                    onClick={() => handleSendToWorkspace(url)}
                  >
                    <Send className="w-3.5 h-3.5" /> 发送到工作台
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 全屏预览（拍立得） ─── */}
      {previewSrc && (
        <div
          onClick={() => { setPreviewSrc(null); setPreviewSize(null) }}
          className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-[9999] cursor-pointer"
        >
          <div
            className="relative bg-white rounded-sm shadow-[0_8px_40px_rgba(0,0,0,0.45),0_2px_8px_rgba(0,0,0,0.2)] cursor-default"
            style={{
              padding: '10px 10px 48px 10px',
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
                const maxW = window.innerWidth * 0.92 - 20
                const maxH = window.innerHeight * 0.85 - 58
                const scale = Math.min(maxW / naturalW, maxH / naturalH, 1)
                setPreviewSize({ width: Math.round(naturalW * scale), height: Math.round(naturalH * scale) })
              }}
            />
            <div className="absolute bottom-2 left-0 right-0 flex justify-center">
              <span className="text-[11px] text-[#999] font-light tracking-wider" style={{ fontFamily: 'Georgia, serif' }}>这个款真好看！！！</span>
            </div>
            <button
              className="absolute -top-2 -right-2 w-8 h-8 bg-white shadow-lg text-[#666] border-none rounded-full flex items-center justify-center cursor-pointer hover:text-[#333] active:scale-90 transition-all z-10"
              onClick={() => { setPreviewSrc(null); setPreviewSize(null) }}
            >
              <X className="w-4 h-4" />
            </button>
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

// ─── 通用 Select 组件 ───
function SelectField({ label, value, options, onChange, hint }: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">{label}</label>
      <select style={selectStyle} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      {hint && <span className="text-[11px] text-[#c9bfb5] leading-relaxed">{hint}</span>}
    </div>
  )
}
