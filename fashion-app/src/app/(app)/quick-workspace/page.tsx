'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Sparkles, Wand2, Image as ImageIcon, Users, Download, RefreshCw, Star, X, Check, Camera, Smartphone, Layers } from 'lucide-react'
import { ImageUploader } from '@/lib/components/common/ImageUploader'
import { workspaceApi } from '@/lib/api/workspace'
import { useTaskStore } from '@/lib/stores/taskStore'
import { useAuthStore } from '@/lib/stores/authStore'
import { useNotificationStore } from '@/lib/stores/notificationStore'
import { useDraftStore } from '@/lib/stores/draftStore'
import { getErrorMessage } from '@/lib/utils/api'
import type { FavoriteType, QuickWorkspaceAspectRatio, QuickWorkspaceFraming, QuickWorkspaceMode } from '@/lib/types'
import { CAMERA_PRESETS, PHONE_PRESETS, isValidDeviceId } from '@/lib/device-presets'
import { TutorialButton } from '@/lib/components/common/TutorialModal'
import { TUTORIALS } from '@/lib/tutorials'

const ASPECT_OPTIONS: { value: QuickWorkspaceAspectRatio; label: string }[] = [
  { value: '3:4', label: '3:4（竖向人像）' },
  { value: '1:1', label: '1:1（正方形）' },
  { value: '4:3', label: '4:3（横向）' },
  { value: '16:9', label: '16:9（宽屏横向）' },
  { value: '9:16', label: '9:16（手机竖屏）' },
]

const FRAMING_OPTIONS: { value: QuickWorkspaceFraming; label: string }[] = [
  { value: 'auto', label: '自动' },
  { value: 'half', label: '半身' },
  { value: 'full', label: '全身' },
]

const MODES: { id: QuickWorkspaceMode; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  {
    id: 'background',
    label: '背景图模式',
    desc: '上传纯背景图，AI 自动决定模特站位与姿势，一键合成最终街拍',
    icon: ImageIcon,
  },
  {
    id: 'fusion',
    label: '融合模式',
    desc: '上传带人物的图片，AI 读取原人物的位置与姿势后，换成你的模特和新衣服',
    icon: Users,
  },
]

export default function QuickWorkspacePage() {
  const quickDraft = useDraftStore((s) => s.quickWorkspaceDraft)
  const setQuickDraft = useDraftStore((s) => s.setQuickWorkspaceDraft)
  const clearQuickDraft = useDraftStore((s) => s.clearQuickWorkspaceDraft)

  const [mode, setMode] = useState<QuickWorkspaceMode>(quickDraft?.mode || 'background')
  const [clothingUrl, setClothingUrl] = useState(quickDraft?.clothingUrl || '')
  const [clothingBackUrl, setClothingBackUrl] = useState(quickDraft?.clothingBackUrl || '')
  const [modelImageUrl, setModelImageUrl] = useState(quickDraft?.modelImageUrl || '')
  const [sceneImageUrl, setSceneImageUrl] = useState(quickDraft?.sceneImageUrl || '')
  const [extraPrompt, setExtraPrompt] = useState(quickDraft?.extraPrompt || '')
  const [aspectRatio, setAspectRatio] = useState<QuickWorkspaceAspectRatio>(quickDraft?.aspectRatio || '3:4')
  const [framing, setFraming] = useState<QuickWorkspaceFraming>(quickDraft?.framing || 'auto')
  const [device, setDevice] = useState<string>(
    quickDraft?.device && isValidDeviceId(quickDraft.device) ? quickDraft.device : 'auto'
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [favDialog, setFavDialog] = useState<null | { type: FavoriteType; imageUrl: string; backUrl?: string; defaultName: string }>(null)
  const [favName, setFavName] = useState('')
  const [favSaving, setFavSaving] = useState(false)

  const canSaveFullConfig = !!clothingUrl && !!modelImageUrl && !!sceneImageUrl

  const isFirstPersistRef = useRef(true)
  useEffect(() => {
    if (isFirstPersistRef.current) {
      isFirstPersistRef.current = false
      return
    }
    setQuickDraft({
      mode,
      clothingUrl,
      clothingBackUrl,
      modelImageUrl,
      sceneImageUrl,
      extraPrompt,
      aspectRatio,
      framing,
      device,
    })
  }, [mode, clothingUrl, clothingBackUrl, modelImageUrl, sceneImageUrl, extraPrompt, aspectRatio, framing, device, setQuickDraft])

  const pollTask = useTaskStore((s) => s.pollTask)
  const currentTask = useTaskStore((s) => s.currentTask)
  const isPolling = useTaskStore((s) => s.isPolling)
  const setCurrentTask = useTaskStore((s) => s.setCurrentTask)
  const clearTask = useTaskStore((s) => s.clearTask)
  const updateCredits = useAuthStore((s) => s.updateCredits)
  const addNotification = useNotificationStore((s) => s.add)

  const canSubmit = useMemo(() => {
    return !!clothingUrl && !!modelImageUrl && !!sceneImageUrl && !submitting && !isPolling
  }, [clothingUrl, modelImageUrl, sceneImageUrl, submitting, isPolling])

  const handleReset = useCallback(() => {
    clearTask()
    setError('')
  }, [clearTask])

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return
    setError('')
    setSubmitting(true)
    clearTask()
    try {
      const task = await workspaceApi.createQuickWorkspaceTask({
        clothingUrl,
        clothingBackUrl: clothingBackUrl || undefined,
        modelImageUrl,
        sceneImageUrl,
        mode,
        aspectRatio,
        framing,
        device,
        extraPrompt: extraPrompt.trim() || undefined,
      })
      setCurrentTask(task)
      void workspaceApi.getBalance().then(updateCredits).catch(() => undefined)
      void pollTask(task.id).then((finished) => {
        if (!finished) return
        if (finished.status === 'FAILED') {
          addNotification({ type: 'error', message: finished.errorMsg || '生成失败' })
        } else {
          addNotification({ type: 'success', message: '快速工作台生图完成' })
          void workspaceApi.getBalance().then(updateCredits).catch(() => undefined)
        }
      })
    } catch (err) {
      setError(getErrorMessage(err, '提交失败，请重试'))
    } finally {
      setSubmitting(false)
    }
  }, [canSubmit, clothingUrl, clothingBackUrl, modelImageUrl, sceneImageUrl, mode, aspectRatio, framing, device, extraPrompt, clearTask, setCurrentTask, pollTask, updateCredits, addNotification])

  const openFavDialog = useCallback((type: FavoriteType) => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const tsLabel = `${now.getMonth() + 1}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
    if (type === 'clothing') {
      if (!clothingUrl) return
      setFavDialog({ type, imageUrl: clothingUrl, backUrl: clothingBackUrl, defaultName: `服装 · ${tsLabel}` })
      setFavName(`服装 · ${tsLabel}`)
    } else if (type === 'model') {
      if (!modelImageUrl) return
      setFavDialog({ type, imageUrl: modelImageUrl, defaultName: `模特 · ${tsLabel}` })
      setFavName(`模特 · ${tsLabel}`)
    } else if (type === 'scene') {
      if (!sceneImageUrl) return
      setFavDialog({ type, imageUrl: sceneImageUrl, defaultName: `场景 · ${tsLabel}` })
      setFavName(`场景 · ${tsLabel}`)
    } else if (type === 'full') {
      const preview = modelImageUrl || sceneImageUrl || clothingUrl
      if (!preview) return
      const defaultName = `完整配置 · ${tsLabel}`
      setFavDialog({ type, imageUrl: preview, defaultName })
      setFavName(defaultName)
    }
  }, [clothingUrl, clothingBackUrl, modelImageUrl, sceneImageUrl])

  const closeFavDialog = useCallback(() => {
    if (favSaving) return
    setFavDialog(null)
    setFavName('')
  }, [favSaving])

  const handleSaveFavorite = useCallback(async () => {
    if (!favDialog) return
    const name = favName.trim() || favDialog.defaultName
    if (!name) return
    setFavSaving(true)
    try {
      let data: Record<string, unknown>
      if (favDialog.type === 'full') {
        data = {
          mode,
          clothingUrl,
          clothingBackUrl: clothingBackUrl || undefined,
          modelImageUrl,
          sceneImageUrl,
          aspectRatio,
          framing,
          device,
          extraPrompt: extraPrompt.trim() || undefined,
        }
      } else {
        data = { imageUrl: favDialog.imageUrl }
        if (favDialog.type === 'clothing' && favDialog.backUrl) {
          data.clothingBackUrl = favDialog.backUrl
        }
      }
      await workspaceApi.createFavorite({
        type: favDialog.type,
        name,
        data,
        previewUrl: favDialog.imageUrl,
      })
      addNotification({ type: 'success', message: `已收藏到素材库：${name}` })
      setFavDialog(null)
      setFavName('')
    } catch (err) {
      addNotification({ type: 'error', message: getErrorMessage(err, '收藏失败') })
    } finally {
      setFavSaving(false)
    }
  }, [favDialog, favName, mode, clothingUrl, clothingBackUrl, modelImageUrl, sceneImageUrl, aspectRatio, framing, device, extraPrompt, addNotification])

  const handleClearAll = useCallback(() => {
    clearTask()
    clearQuickDraft()
    setClothingUrl('')
    setClothingBackUrl('')
    setModelImageUrl('')
    setSceneImageUrl('')
    setExtraPrompt('')
    setAspectRatio('3:4')
    setFraming('auto')
    setDevice('auto')
    setMode('background')
    setError('')
  }, [clearTask, clearQuickDraft])

  const status = currentTask?.status
  const showLoading = submitting || isPolling || (status && status !== 'COMPLETED' && status !== 'FAILED' && status !== 'DONE')
  const resultUrl = currentTask?.resultUrl && (currentTask.status === 'COMPLETED' || currentTask.status === 'DONE') ? currentTask.resultUrl : ''
  const failed = status === 'FAILED'

  return (
    <div className="w-full min-h-full">
      <div className="max-w-[1400px] mx-auto md:px-10 md:py-8">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-2.5 mb-5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #c67b5c, #d4a882)' }}
          >
            <Wand2 className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-[18px] font-bold tracking-tight text-[#2d2422] flex-1">快速工作台</h1>
          <TutorialButton id="quick-workspace" steps={TUTORIALS['quick-workspace']} />
        </div>
        {/* Desktop header */}
        <header className="hidden md:block mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(198,123,92,0.08)] border border-[rgba(198,123,92,0.18)] mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[#c67b5c]" />
            <span className="text-[11px] font-semibold text-[#c67b5c]">Quick Workspace</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] font-bold text-[#2d2422]">快速工作台</h1>
            <div className="ml-auto"><TutorialButton id="quick-workspace" steps={TUTORIALS['quick-workspace']} /></div>
          </div>
          <p className="text-[13px] text-[#8b7355] mt-1">上传衣服 + 模特 + 场景图，一键合成街拍级成片。</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_520px] gap-6">
          {/* 左：配置 */}
          <div className="flex flex-col gap-5">
            {/* Mode */}
            <section className="bg-white/70 backdrop-blur rounded-2xl border border-[rgba(139,115,85,0.1)] p-5">
              <div className="text-[12px] font-semibold text-[#8b7355] mb-3">① 选择模式</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {MODES.map((m) => {
                  const Icon = m.icon
                  const active = mode === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMode(m.id)}
                      className="text-left p-4 rounded-xl border transition-all"
                      style={{
                        borderColor: active ? 'rgba(198,123,92,0.5)' : 'rgba(139,115,85,0.12)',
                        background: active ? 'rgba(198,123,92,0.06)' : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-4 h-4 text-[#c67b5c]" />
                        <span className="text-[13px] font-semibold text-[#2d2422]">{m.label}</span>
                      </div>
                      <div className="text-[11px] text-[#8b7355] leading-relaxed">{m.desc}</div>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Model */}
            <section className="bg-white/70 backdrop-blur rounded-2xl border border-[rgba(139,115,85,0.1)] p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[12px] font-semibold text-[#8b7355]">② 选择模特</div>
                <FavButton disabled={!modelImageUrl} onClick={() => openFavDialog('model')} />
              </div>
              <ImageUploader label="模特照片" value={modelImageUrl} onChange={setModelImageUrl} helperText="清晰的半身/全身照作为面部锚点" />
            </section>

            {/* Clothing */}
            <section className="bg-white/70 backdrop-blur rounded-2xl border border-[rgba(139,115,85,0.1)] p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[12px] font-semibold text-[#8b7355]">③ 上传衣服</div>
                <FavButton disabled={!clothingUrl} onClick={() => openFavDialog('clothing')} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] font-semibold text-[#8b7355] mb-2">正面 <span className="text-[#c47070]">*</span></div>
                  <ImageUploader label="衣服正面" value={clothingUrl} onChange={setClothingUrl} helperText="服装主视图，清晰无遮挡" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-[#8b7355] mb-2">反面 <span className="text-[#c9bfb5]">(可选)</span></div>
                  <ImageUploader label="衣服反面" value={clothingBackUrl} onChange={setClothingBackUrl} helperText="若有反面细节请上传" />
                </div>
              </div>
            </section>

            {/* Scene */}
            <section className="bg-white/70 backdrop-blur rounded-2xl border border-[rgba(139,115,85,0.1)] p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[12px] font-semibold text-[#8b7355]">
                  ④ 上传{mode === 'background' ? '干净背景图' : '含原人物的场景图'}
                </div>
                <FavButton disabled={!sceneImageUrl} onClick={() => openFavDialog('scene')} />
              </div>
              <ImageUploader
                label={mode === 'background' ? '背景图' : '场景图（含原人物）'}
                value={sceneImageUrl}
                onChange={setSceneImageUrl}
                helperText={mode === 'background'
                  ? 'AI 会自动决定最佳站位与姿势'
                  : 'AI 会提取原人物的位置与姿势，替换成新模特与新衣服'}
              />
            </section>

            {/* Output options */}
            <section className="bg-white/70 backdrop-blur rounded-2xl border border-[rgba(139,115,85,0.1)] p-5">
              <div className="text-[12px] font-semibold text-[#8b7355] mb-3">⑤ 输出设置</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] font-semibold text-[#8b7355] mb-2">图片比例</div>
                  <div className="flex flex-wrap gap-2">
                    {ASPECT_OPTIONS.map((opt) => {
                      const active = aspectRatio === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setAspectRatio(opt.value)}
                          className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all border"
                          style={{
                            background: active ? 'linear-gradient(135deg, #c67b5c, #d4a882)' : 'rgba(139,115,85,0.03)',
                            color: active ? '#fff' : '#8b7355',
                            borderColor: active ? 'transparent' : 'rgba(139,115,85,0.12)',
                          }}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-[#8b7355] mb-2">构图</div>
                  <div className="flex flex-wrap gap-2">
                    {FRAMING_OPTIONS.map((opt) => {
                      const active = framing === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setFraming(opt.value)}
                          className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all border"
                          style={{
                            background: active ? 'linear-gradient(135deg, #c67b5c, #d4a882)' : 'rgba(139,115,85,0.03)',
                            color: active ? '#fff' : '#8b7355',
                            borderColor: active ? 'transparent' : 'rgba(139,115,85,0.12)',
                          }}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* 拍摄模式 */}
              <div className="mt-5 pt-5 border-t border-[rgba(139,115,85,0.08)]">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="text-[11px] font-semibold text-[#8b7355]">拍摄模式</div>
                  <div className="text-[10px] text-[#b0a59a]">不同模式对应不同焦距、景深、光线氛围与构图节奏</div>
                </div>

                {/* 自动 */}
                <div className="mb-3">
                  <button
                    type="button"
                    onClick={() => setDevice('auto')}
                    className="w-full text-left px-3 py-2 rounded-lg border transition-all"
                    style={{
                      borderColor: device === 'auto' ? 'rgba(198,123,92,0.5)' : 'rgba(139,115,85,0.12)',
                      background: device === 'auto' ? 'rgba(198,123,92,0.06)' : 'rgba(139,115,85,0.02)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-[#c67b5c]" />
                      <span className="text-[12px] font-semibold text-[#2d2422]">自动</span>
                      <span className="text-[10px] text-[#8b7355]">不指定拍摄模式，由 AI 自主决定</span>
                    </div>
                  </button>
                </div>

                {/* 单反 */}
                <div className="mb-2 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-[#8b7355]" />
                  <span className="text-[11px] font-semibold text-[#8b7355]">单反</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                  {CAMERA_PRESETS.map((p) => {
                    const active = device === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setDevice(p.id)}
                        className="text-left p-3 rounded-lg border transition-all"
                        style={{
                          borderColor: active ? 'rgba(198,123,92,0.5)' : 'rgba(139,115,85,0.12)',
                          background: active ? 'rgba(198,123,92,0.06)' : 'rgba(255,255,255,0.5)',
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] font-semibold text-[#2d2422]">{p.label}</span>
                          {active && <Check className="w-3.5 h-3.5 text-[#c67b5c]" />}
                        </div>
                        <div className="text-[10px] text-[#c67b5c] font-mono mb-1">{p.specLine}</div>
                        <div className="text-[10px] text-[#8b7355] leading-relaxed">{p.desc}</div>
                      </button>
                    )
                  })}
                </div>

                {/* 手机 */}
                <div className="mb-2 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-[#8b7355]" />
                  <span className="text-[11px] font-semibold text-[#8b7355]">手机</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {PHONE_PRESETS.map((p) => {
                    const active = device === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setDevice(p.id)}
                        className="text-left p-3 rounded-lg border transition-all"
                        style={{
                          borderColor: active ? 'rgba(198,123,92,0.5)' : 'rgba(139,115,85,0.12)',
                          background: active ? 'rgba(198,123,92,0.06)' : 'rgba(255,255,255,0.5)',
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] font-semibold text-[#2d2422]">{p.label}</span>
                          {active && <Check className="w-3.5 h-3.5 text-[#c67b5c]" />}
                        </div>
                        <div className="text-[10px] text-[#c67b5c] font-mono mb-1">{p.specLine}</div>
                        <div className="text-[10px] text-[#8b7355] leading-relaxed">{p.desc}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </section>

            {/* Extra prompt */}
            <section className="bg-white/70 backdrop-blur rounded-2xl border border-[rgba(139,115,85,0.1)] p-5">
              <div className="text-[12px] font-semibold text-[#8b7355] mb-2">⑥ 附加提示（可选）</div>
              <textarea
                value={extraPrompt}
                onChange={(e) => setExtraPrompt(e.target.value)}
                placeholder="例：侧身回眸、手插口袋、更偏冷色调..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-[13px] bg-white border border-[rgba(139,115,85,0.12)] outline-none focus:border-[rgba(198,123,92,0.35)] text-[#2d2422] resize-none"
              />
            </section>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-[rgba(196,112,112,0.08)] border border-[rgba(196,112,112,0.2)] text-[12px] text-[#c47070]">{error}</div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex-1 min-w-[180px] inline-flex items-center justify-center gap-2 h-12 rounded-xl text-[14px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #c67b5c, #d4a882)' }}
              >
                {submitting || isPolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {submitting ? '提交中...' : isPolling ? 'AI 合成中...' : '一键生成'}
              </button>
              <button
                type="button"
                onClick={() => openFavDialog('full')}
                disabled={!canSaveFullConfig}
                title={canSaveFullConfig ? '把当前服装 + 模特 + 场景 + 参数整套打包到素材库' : '请先上传 服装 / 模特 / 场景 三张图'}
                className="h-12 px-4 rounded-xl border text-[12px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                style={{
                  borderColor: canSaveFullConfig ? 'rgba(198,123,92,0.35)' : 'rgba(139,115,85,0.15)',
                  color: canSaveFullConfig ? '#c67b5c' : '#b0a59a',
                  background: canSaveFullConfig ? 'rgba(198,123,92,0.06)' : 'rgba(139,115,85,0.02)',
                }}
              >
                <Layers className="w-4 h-4" />
                收藏完整配置
              </button>
              {(resultUrl || failed) && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="h-12 px-4 rounded-xl border border-[rgba(139,115,85,0.2)] text-[13px] font-medium text-[#8b7355] hover:bg-[rgba(139,115,85,0.04)]"
                >
                  <RefreshCw className="w-4 h-4 inline -mt-0.5 mr-1" />重置结果
                </button>
              )}
              <button
                type="button"
                onClick={handleClearAll}
                className="h-12 px-4 rounded-xl border border-[rgba(139,115,85,0.2)] text-[13px] font-medium text-[#8b7355] hover:bg-[rgba(139,115,85,0.04)]"
                title="清空所有已上传的图片和表单"
              >
                清空表单
              </button>
            </div>
          </div>

          {/* 右：结果 */}
          <div className="lg:sticky lg:top-4 self-start w-full">
            <div className="bg-white/70 backdrop-blur rounded-2xl border border-[rgba(139,115,85,0.1)] p-5 min-h-[520px] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[12px] font-semibold text-[#8b7355]">生成结果</div>
                {currentTask && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(139,115,85,0.06)] text-[#8b7355]">{currentTask.status}</span>
                )}
              </div>

              <div className="flex-1 rounded-xl border border-dashed border-[rgba(139,115,85,0.18)] bg-[rgba(139,115,85,0.02)] flex items-center justify-center overflow-hidden p-4">
                {showLoading && !resultUrl && (
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-[#c67b5c] mx-auto mb-3" />
                    <div className="text-[12px] text-[#8b7355] font-medium">
                      {status === 'GENERATING' ? 'AI 正在合成图像...' : '任务准备中...'}
                    </div>
                  </div>
                )}
                {!showLoading && !resultUrl && !failed && (
                  <div className="text-center text-[#c9bfb5]">
                    <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-60" />
                    <div className="text-[12px]">完成左侧配置后点击「一键生成」</div>
                  </div>
                )}
                {failed && (
                  <div className="text-center text-[#c47070]">
                    <div className="text-[13px] font-semibold mb-1">生成失败</div>
                    <div className="text-[11px] opacity-80">{currentTask?.errorMsg || '请重试或联系管理员'}</div>
                  </div>
                )}
                {resultUrl && (
                  <img src={resultUrl} alt="结果" className="max-w-full max-h-[560px] object-contain rounded-lg" />
                )}
              </div>

              {resultUrl && (
                <div className="mt-3 flex items-center gap-2">
                  <a
                    href={resultUrl}
                    download
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-lg border border-[rgba(139,115,85,0.18)] text-[12px] font-medium text-[#8b7355] hover:bg-[rgba(139,115,85,0.04)]"
                  >
                    <Download className="w-4 h-4" />下载
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 收藏到素材库 Dialog */}
      {favDialog && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={closeFavDialog}
        >
          <div
            className="w-full max-w-[400px] bg-white rounded-2xl shadow-2xl border border-white/60 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {favDialog.type === 'full' ? <Layers className="w-4 h-4 text-[#c67b5c]" /> : <Star className="w-4 h-4 text-[#c67b5c]" />}
                <h3 className="text-[14px] font-semibold text-[#2d2422]">
                  {favDialog.type === 'full' ? '收藏完整配置到素材库' : `收藏${favDialog.type === 'clothing' ? '服装' : favDialog.type === 'model' ? '模特' : '场景'}到素材库`}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeFavDialog}
                disabled={favSaving}
                className="text-[#b0a59a] hover:text-[#6f5f55] transition-colors disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {favDialog.type === 'full' && (
              <div className="mb-3 p-3 rounded-xl bg-[rgba(198,123,92,0.05)] border border-[rgba(198,123,92,0.12)]">
                <div className="text-[11px] font-semibold text-[#8b7355] mb-1.5">本次打包内容</div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[
                    { label: '服装', url: clothingUrl },
                    { label: '模特', url: modelImageUrl },
                    { label: '场景', url: sceneImageUrl },
                  ].map((it) => (
                    <div key={it.label} className="flex flex-col items-center gap-1">
                      <div className="w-full aspect-square rounded-lg overflow-hidden border border-[rgba(139,115,85,0.12)] bg-[rgba(139,115,85,0.03)]">
                        {it.url ? (
                          <img src={it.url} alt={it.label} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-[#c9bfb5]">无</div>
                        )}
                      </div>
                      <div className="text-[10px] text-[#8b7355]">{it.label}</div>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-[#8b7355] leading-relaxed">
                  <span className="mr-2">模式：{mode === 'background' ? '背景图' : '融合'}</span>
                  <span className="mr-2">比例：{aspectRatio}</span>
                  <span className="mr-2">构图：{framing === 'auto' ? '自动' : framing === 'half' ? '半身' : '全身'}</span>
                  <span>设备：{device === 'auto' ? '自动' : device}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3 mb-4">
              {favDialog.type !== 'full' && (
                <div className="w-20 h-20 rounded-xl overflow-hidden border border-[rgba(139,115,85,0.12)] flex-shrink-0 bg-[rgba(139,115,85,0.03)]">
                  <img src={favDialog.imageUrl} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <label className="block text-[11px] font-medium text-[#8b7355] mb-1.5">名称</label>
                <input
                  type="text"
                  value={favName}
                  onChange={(e) => setFavName(e.target.value)}
                  placeholder={favDialog.defaultName}
                  disabled={favSaving}
                  className="w-full h-10 px-3 rounded-lg border border-[rgba(139,115,85,0.15)] bg-white text-[13px] text-[#2d2422] outline-none focus:border-[rgba(198,123,92,0.4)] focus:ring-2 focus:ring-[rgba(198,123,92,0.08)] disabled:opacity-60"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !favSaving) {
                      void handleSaveFavorite()
                    }
                  }}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeFavDialog}
                disabled={favSaving}
                className="flex-1 h-10 rounded-xl border border-[rgba(139,115,85,0.2)] text-[12px] font-medium text-[#8b7355] hover:bg-[rgba(139,115,85,0.04)] disabled:opacity-40"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => { void handleSaveFavorite() }}
                disabled={favSaving || !favName.trim()}
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-xl text-[12px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #c67b5c, #d4a882)' }}
              >
                {favSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {favSaving ? '保存中...' : '保存收藏'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FavButton({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={disabled ? '先上传图片再收藏' : '收藏到素材库'}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: disabled ? 'rgba(139,115,85,0.04)' : 'rgba(198,123,92,0.08)',
        color: disabled ? '#b0a59a' : '#c67b5c',
        borderColor: disabled ? 'rgba(139,115,85,0.1)' : 'rgba(198,123,92,0.2)',
      }}
    >
      <Star className="w-3 h-3" />
      收藏
    </button>
  )
}
