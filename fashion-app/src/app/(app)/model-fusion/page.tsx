'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { ImageUploader } from '@/lib/components/common/ImageUploader'
import { workspaceApi } from '@/lib/api/workspace'
import { useAuthStore } from '@/lib/stores/authStore'
import { useDraftStore } from '@/lib/stores/draftStore'
import { useNotificationStore } from '@/lib/stores/notificationStore'
import { getErrorMessage } from '@/lib/utils/api'
import { Users, Download, Send, X, Sparkles, Sliders, Blend, Crown, Shuffle, Settings2, Loader2, ImageIcon, Smartphone, Camera } from 'lucide-react'
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
  borderRadius: '10px',
  padding: '8px 28px 8px 10px',
  fontSize: '13px',
  color: '#2d2422',
  width: '100%',
  outline: 'none',
  transition: 'all 0.2s',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
}

const PRESET_PROMPTS: { key: string; label: string; text: string; icon: React.ComponentType<{ className?: string }> }[] = [
  {
    key: 'phone',
    label: '手机拍摄',
    icon: Smartphone,
    text: 'shot on iPhone 16, 26mm lens, Apple ProRAW photo, natural ambient lighting, slightly uneven exposure, subtle highlights slightly overexposed, soft shadows, candid moment, unposed, looking at camera, slightly off-center composition, casual framing, mild motion blur, slight camera shake, fine grain noise, realistic texture, imperfect skin details, visible pores, lens distortion, slight chromatic aberration, background slightly messy and organic, real-life atmosphere, everyday snapshot feeling',
  },
  {
    key: 'dslr',
    label: '单反拍摄',
    icon: Camera,
    text: 'shot on DSLR, 85mm lens, f/1.4 aperture, very shallow depth of field, sharp focus on eyes, creamy background bokeh, cinematic natural lighting, high detail skin texture, visible pores, subtle imperfections, realistic shadows, slight lens breathing, soft highlight roll-off',
  },
]

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
  const setQuickWorkspaceDraft = useDraftStore((state) => state.setQuickWorkspaceDraft)
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
  const [genExtraPrompt, setGenExtraPrompt] = useState('')

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
      // 自动保存到素材库
      try {
        await workspaceApi.createFavorite({
          type: 'model',
          name: `模特融合 ${new Date().toLocaleDateString('zh-CN')}`,
          data: { source: 'model-fusion', strategy, modelUrls: urls, weights: activeWeights } as unknown as Record<string, unknown>,
          previewUrl: data.resultUrl,
        })
      } catch { /* 静默失败，不影响主流程 */ }
      addNotification({ type: 'success', message: '模特合成完成！已同步到素材库' })
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
        referenceUrl || undefined,
        genExtraPrompt.trim() || undefined
      )
      if (!data.resultUrls?.length) {
        setError('AI 未返回生成结果，请重试')
        return
      }
      setResultUrl(data.resultUrls[0])
      setResultUrls(data.resultUrls)
      setFusionResult({ resultUrl: data.resultUrls[0], modelUrls: [] })
      updateCredits(await workspaceApi.getBalance())
      // 自动保存到素材库
      try {
        await workspaceApi.createFavorite({
          type: 'model',
          name: `模特生成 ${new Date().toLocaleDateString('zh-CN')}`,
          data: { source: 'model-fusion', config: genConfig } as unknown as Record<string, unknown>,
          previewUrl: data.resultUrls[0],
        })
      } catch { /* 静默失败，不影响主流程 */ }
      addNotification({ type: 'success', message: '模特生成完成！已同步到素材库' })
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

  // ─── 发送到快速工作台（把模特图注入到 quickWorkspaceDraft.modelImageUrl） ───
  const handleSendToWorkspace = (url?: string) => {
    const src = url || resultUrl
    if (!src) return
    try {
      const existing = useDraftStore.getState().quickWorkspaceDraft
      setQuickWorkspaceDraft({
        mode: existing?.mode ?? 'background',
        clothingUrl: existing?.clothingUrl ?? '',
        clothingBackUrl: existing?.clothingBackUrl ?? '',
        modelImageUrl: src,
        sceneImageUrl: existing?.sceneImageUrl ?? '',
        aspectRatio: existing?.aspectRatio ?? '3:4',
        framing: existing?.framing ?? 'auto',
        extraPrompt: existing?.extraPrompt ?? '',
      })
      addNotification({ type: 'success', message: '已发送到快速工作台，正在跳转...' })
      router.push('/quick-workspace')
    } catch {
      addNotification({ type: 'error', message: '发送到快速工作台失败' })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Mobile header */}
      <div className="md:hidden flex items-center gap-2.5 -mb-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center flex-shrink-0">
          <Users className="w-4 h-4 text-white" />
        </div>
        <h1 className="text-[18px] font-bold tracking-tight text-[#2d2422] flex-1">模特工厂</h1>
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

      {/* ═══════════════ 左右分栏布局 ═══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_440px] gap-6">
        {/* ─── 左栏：配置表单 ─── */}
        <div className="flex flex-col gap-6 min-w-0">
          {/* 顶部 Tab 切换 */}
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
          <div className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-4 sm:p-6 shadow-sm">
            <div className="mb-4 sm:mb-5">
              <h3 className="text-[15px] font-bold text-[#2d2422]">基础属性</h3>
              <p className="text-[12px] text-[#9b8e82] mt-1">决定模特的整体气质方向</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-3">
              <SelectField label="风格类别" value={genConfig.category} options={categoryOptions} onChange={v => updateGenConfig({ category: v })} hint="决定整体气质和造型风格" />
              <SelectField label="性别" value={genConfig.gender} options={genderOptions} onChange={v => updateGenConfig({ gender: v })} />
              <SelectField label="年龄" value={genConfig.age} options={ageOptions} onChange={v => updateGenConfig({ age: v })} />
              <SelectField label="人种" value={genConfig.ethnicity} options={ethnicityOptions} onChange={v => updateGenConfig({ ethnicity: v })} />
            </div>
          </div>

          {/* 身体特征 */}
          <div className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-4 sm:p-6 shadow-sm">
            <div className="mb-4 sm:mb-5">
              <h3 className="text-[15px] font-bold text-[#2d2422]">身体特征</h3>
              <p className="text-[12px] text-[#9b8e82] mt-1">肤色、体型、身高等身体属性</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-3">
              <SelectField label="肤色" value={genConfig.skinTone} options={skinOptions} onChange={v => updateGenConfig({ skinTone: v })} />
              <SelectField label="体型" value={genConfig.bodyType} options={bodyOptions} onChange={v => updateGenConfig({ bodyType: v })} />
              <SelectField label="身高" value={genConfig.height ?? ''} options={heightOptions} onChange={v => updateGenConfig({ height: v })} />
            </div>
          </div>

          {/* 面部与发型 */}
          <div className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-4 sm:p-6 shadow-sm">
            <div className="mb-4 sm:mb-5">
              <h3 className="text-[15px] font-bold text-[#2d2422]">面部与发型</h3>
              <p className="text-[12px] text-[#9b8e82] mt-1">脸型、发型、发色、妆容等精细控制</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-3">
              <SelectField label="脸型" value={genConfig.faceShape ?? ''} options={faceShapeOptions} onChange={v => updateGenConfig({ faceShape: v })} />
              <SelectField label="发型" value={genConfig.hairStyle ?? ''} options={hairStyleOptions} onChange={v => updateGenConfig({ hairStyle: v })} />
              <SelectField label="发色" value={genConfig.hairColor ?? ''} options={hairColorOptions} onChange={v => updateGenConfig({ hairColor: v })} />
              <SelectField label="妆造 / 面部细节" value={genConfig.faceFeature} options={faceFeatureOptions} onChange={v => updateGenConfig({ faceFeature: v })} hint="妆容风格、雀斑酒窝等特征" />
              <SelectField label="表情" value={genConfig.expression || ''} options={expressionOptions} onChange={v => updateGenConfig({ expression: v })} />
            </div>
          </div>

          {/* 补充提示词（可选） */}
          <div className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-4 sm:p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-[15px] font-bold text-[#2d2422]">补充提示词 <span className="text-[12px] font-normal text-[#b0a59a]">（可选）</span></h3>
              <p className="text-[12px] text-[#9b8e82] mt-1">用自然语言补充额外需求，比如「戴银色细框眼镜」「浅笑嘴角微翘」「背景换成米白毛毯」等。保持简短，避免和上方参数冲突。</p>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_PROMPTS.map(preset => {
                const active = genExtraPrompt === preset.text
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setGenExtraPrompt(active ? '' : preset.text)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all border"
                    style={{
                      background: active ? 'rgba(198,123,92,0.08)' : 'rgba(139,115,85,0.03)',
                      borderColor: active ? 'rgba(198,123,92,0.35)' : 'rgba(139,115,85,0.1)',
                      color: active ? '#c67b5c' : '#8b7355',
                    }}
                  >
                    <preset.icon className="w-3.5 h-3.5" />
                    {preset.label}
                  </button>
                )
              })}
            </div>
            <textarea
              value={genExtraPrompt}
              onChange={e => setGenExtraPrompt(e.target.value.slice(0, 500))}
              placeholder="例：戴一副极细银框眼镜；耳朵戴一只小珍珠耳钉；表情自然带一丝浅笑。"
              rows={3}
              className="w-full px-4 py-3 rounded-xl text-[13px] text-[#2d2422] bg-[rgba(139,115,85,0.03)] border border-[rgba(139,115,85,0.1)] outline-none focus:border-[rgba(198,123,92,0.4)] focus:bg-white transition-all resize-none placeholder:text-[#c9bfb5]"
            />
            <div className="mt-1.5 text-right text-[11px] text-[#b0a59a] tabular-nums">
              {genExtraPrompt.length} / 500
            </div>
          </div>

          {/* 参考图（可选） */}
          <div className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-4 sm:p-6 shadow-sm">
            <div className="mb-4 sm:mb-5">
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

        </div>
        {/* ─── /左栏 ─── */}

        {/* ─── 右栏：结果面板（sticky） ─── */}
        <aside className="lg:sticky lg:top-4 self-start w-full">
          <div className="bg-white/75 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-sm min-h-[520px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-semibold text-[#2d2422] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                {tab === 'generate' ? '生成结果' : '合成结果'}
              </h3>
              {submitting && (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[rgba(198,123,92,0.1)] text-[#c67b5c] font-medium">
                  <Loader2 className="w-3 h-3 animate-spin" /> 生成中
                </span>
              )}
            </div>

            <div className="flex-1 rounded-xl border border-dashed border-[rgba(139,115,85,0.18)] bg-[rgba(139,115,85,0.02)] flex items-center justify-center overflow-hidden p-4 min-h-[420px]">
              {submitting ? (
                <div className="text-center">
                  <div className="relative w-16 h-16 mx-auto mb-4">
                    <div className="absolute inset-0 rounded-full border-4 border-[rgba(198,123,92,0.15)]" />
                    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#c67b5c] animate-spin" />
                  </div>
                  <div className="text-[13px] text-[#2d2422] font-semibold mb-1">
                    {tab === 'generate' ? 'AI 正在生成模特...' : 'AI 正在融合模特...'}
                  </div>
                  <div className="text-[11px] text-[#8b7355]">大约需要 10~30 秒，请稍候</div>
                </div>
              ) : resultUrls.length === 0 ? (
                <div className="text-center text-[#b0a59a]">
                  <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-60" />
                  <div className="text-[12px]">
                    {tab === 'generate' ? '填写左侧参数后点击「生成模特」' : '上传参考图后点击「合成模特」'}
                  </div>
                </div>
              ) : (
                <div className="w-full flex flex-wrap justify-center gap-3">
                  {resultUrls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`结果 ${i + 1}`}
                      onClick={() => setPreviewSrc(url)}
                      className="max-w-full max-h-[420px] object-contain rounded-xl shadow-[0_4px_18px_rgba(0,0,0,0.1)] cursor-pointer hover:shadow-[0_8px_28px_rgba(0,0,0,0.16)] transition-all"
                    />
                  ))}
                </div>
              )}
            </div>

            {!submitting && resultUrls.length > 0 && (
              <div className="mt-4 flex flex-col gap-2">
                {resultUrls.length > 1 && (
                  <div className="text-[11px] text-[#8b7355]">共 {resultUrls.length} 张，点击图片可放大预览</div>
                )}
                <div className="flex gap-2">
                  <button
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-xl text-[12px] font-medium text-[#8b7355] transition-all"
                    style={{ background: 'rgba(139,115,85,0.04)', border: '1px solid rgba(139,115,85,0.1)' }}
                    type="button"
                    onClick={() => handleDownload(resultUrls[0])}
                  >
                    <Download className="w-3.5 h-3.5" /> 下载
                  </button>
                  <button
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-xl text-[12px] font-semibold text-white transition-all"
                    style={{ background: 'linear-gradient(135deg, #c67b5c, #d4a882)' }}
                    type="button"
                    onClick={() => handleSendToWorkspace(resultUrls[0])}
                  >
                    <Send className="w-3.5 h-3.5" /> 发送到快速工作台
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
      {/* ═══════════════ /左右分栏布局 ═══════════════ */}

      {/* ─── 全屏预览（拍立得） ─── */}
      {previewSrc && (
        <div
          onClick={() => { setPreviewSrc(null); setPreviewSize(null) }}
          className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-[9999] cursor-pointer"
        >
          <div
            className="relative bg-white rounded-sm shadow-[0_8px_40px_rgba(0,0,0,0.45),0_2px_8px_rgba(0,0,0,0.2)] cursor-default"
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

// ─── 通用 Select 组件（移动端使用自定义下拉，桌面端使用原生 select） ───
function SelectField({ label, value, options, onChange, hint }: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  hint?: string
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number; upward?: boolean } | null>(null)
  const selectedOption = options.find(opt => opt.value === value)
  const displayLabel = selectedOption?.label || value || '请选择'

  useEffect(() => {
    if (!open || !btnRef.current) return
    const updatePos = () => {
      const rect = btnRef.current!.getBoundingClientRect()
      const maxH = 240
      const gap = 4
      let top = rect.bottom + gap
      // 若下方空间不足则向上展开
      const upward = top + maxH > window.innerHeight && rect.top > maxH + gap
      if (upward) {
        top = rect.top - maxH - gap
      }
      setPos({ top, left: rect.left, width: rect.width, upward })
    }
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [open])

  const dropdown = open && pos && (
    <>
      <div className="fixed inset-0 z-[200]" onClick={() => setOpen(false)} />
      <div
        className="fixed z-[201] max-h-[240px] overflow-y-auto rounded-xl bg-white border border-[rgba(139,115,85,0.12)] shadow-lg py-1"
        style={{ top: pos.top, left: pos.left, width: pos.width }}
      >
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            className="w-full px-3 py-2 text-left text-[13px] transition-colors truncate"
            style={{
              color: opt.value === value ? '#c67b5c' : '#2d2422',
              background: opt.value === value ? 'rgba(198,123,92,0.06)' : 'transparent',
              fontWeight: opt.value === value ? 600 : 400,
            }}
            onClick={() => { onChange(opt.value); setOpen(false) }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </>
  )

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase truncate">{label}</label>
      {/* 移动端：自定义下拉 */}
      <div className="md:hidden relative">
        <button
          ref={btnRef}
          type="button"
          onClick={() => setOpen(true)}
          className="w-full text-left rounded-[10px] border bg-[rgba(139,115,85,0.03)] border-[rgba(139,115,85,0.1)] outline-none transition-all"
          style={{ padding: '8px 28px 8px 10px', fontSize: '13px', color: '#2d2422' }}
        >
          <span className="block truncate">{displayLabel}</span>
          <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#b0a59a] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {typeof document !== 'undefined' && dropdown && createPortal(dropdown, document.body)}
      </div>
      {/* 桌面端：原生 select */}
      <select className="hidden md:block" style={selectStyle} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      {hint && <span className="text-[10px] text-[#c9bfb5] leading-relaxed">{hint}</span>}
    </div>
  )
}
