'use client'

import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react'
import { Loader2, Wand2, Image as ImageIcon, Users, Download, RefreshCw, Star, X, Check, Camera, Smartphone, Layers, Grid3X3 } from 'lucide-react'
import { ImageUploadPicker } from '@/lib/components/common/ImageUploadPicker'
import { ConfirmDialog } from '@/lib/components/common/ConfirmDialog'
import { LookBookPanel } from '@/lib/components/lookbook/LookBookPanel'
import { workspaceApi } from '@/lib/api/workspace'
import { useTaskStore } from '@/lib/stores/taskStore'
import { useAuthStore } from '@/lib/stores/authStore'
import { useNotificationStore } from '@/lib/stores/notificationStore'
import { useDraftStore } from '@/lib/stores/draftStore'
import { useGenerationStore } from '@/lib/stores/generationStore'
import { getErrorMessage } from '@/lib/utils/api'
import type { FavoriteType, GenerationTask, QuickWorkspaceAspectRatio, QuickWorkspaceFraming, QuickWorkspaceMode } from '@/lib/types'
import { CAMERA_PRESETS, PHONE_PRESETS, isValidDeviceId } from '@/lib/device-presets'

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
    desc: '上传带人物的图片，AI 读取原人物的位置与姿势；上传模特则换脸换衣，不上传则保留原模特仅换衣服',
    icon: Users,
  },
]

// ─── Memoized sub-components ────────────────────────────────

const ModeSelector = memo(function ModeSelector({
  mode,
  onSetMode,
}: {
  mode: QuickWorkspaceMode
  onSetMode: (m: QuickWorkspaceMode) => void
}) {
  return (
    <section className="fashion-glass rounded-2xl p-3 md:p-5">
      <div className="text-sm md:text-xs font-semibold text-[var(--text-secondary)] mb-3">① 选择模式</div>
      <div className="grid grid-cols-2 gap-3">
        {MODES.map((m) => {
          const Icon = m.icon
          const active = mode === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSetMode(m.id)}
              className="text-left p-4 rounded-2xl border transition-all flex flex-col items-start"
              style={{
                borderColor: active ? 'rgba(198,123,92,0.5)' : 'rgba(139,115,85,0.12)',
                background: active ? 'var(--bg-active)' : 'var(--bg-muted)',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 text-[#c67b5c]" />
                <span className="text-sm md:text-sm font-semibold text-[var(--text-primary)]">{m.label}</span>
              </div>
              <div className="text-xs md:text-xs text-[var(--text-secondary)] leading-relaxed hidden sm:block">{m.desc}</div>
            </button>
          )
        })}
      </div>
    </section>
  )
})

const ModelUploader = memo(function ModelUploader({
  mode,
  modelImageUrl,
  onSetModelImageUrl,
  onFav,
}: {
  mode: QuickWorkspaceMode
  modelImageUrl: string
  onSetModelImageUrl: (v: string) => void
  onFav: () => void
}) {
  return (
    <section className="fashion-glass rounded-2xl p-3 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm md:text-xs font-semibold text-[var(--text-secondary)]">② 选择模特{mode === 'fusion' && <span className="text-[var(--text-extreme)] ml-1">（可选）</span>}</div>
        <FavButton disabled={!modelImageUrl} onClick={onFav} />
      </div>
      <ImageUploadPicker label="模特照片" value={modelImageUrl} onChange={onSetModelImageUrl} sourceType="model" helperText={mode === 'fusion' && !modelImageUrl ? '不传则保留场景图中的原模特，仅换衣服' : '清晰的半身/全身照作为面部锚点'} />
    </section>
  )
})

const ClothingUploader = memo(function ClothingUploader({
  clothingUrl,
  clothingBackUrl,
  onSetClothingUrl,
  onSetClothingBackUrl,
  onFav,
}: {
  clothingUrl: string
  clothingBackUrl: string
  onSetClothingUrl: (v: string) => void
  onSetClothingBackUrl: (v: string) => void
  onFav: () => void
}) {
  return (
    <section className="fashion-glass rounded-2xl p-3 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm md:text-xs font-semibold text-[var(--text-secondary)]">③ 上传衣服</div>
        <FavButton disabled={!clothingUrl} onClick={onFav} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs md:text-xs font-semibold text-[var(--text-secondary)] mb-2">正面 <span className="text-[#c47070]">*</span></div>
          <ImageUploadPicker label="衣服正面" value={clothingUrl} onChange={onSetClothingUrl} sourceType="clothing" helperText="服装主视图，清晰无遮挡" />
        </div>
        <div>
          <div className="text-xs md:text-xs font-semibold text-[var(--text-secondary)] mb-2">反面 <span className="text-[var(--text-extreme)]">(可选)</span></div>
          <ImageUploadPicker label="衣服反面" value={clothingBackUrl} onChange={onSetClothingBackUrl} sourceType="clothingBack" helperText="若有反面细节请上传" />
        </div>
      </div>
    </section>
  )
})

const SceneUploader = memo(function SceneUploader({
  mode,
  modelImageUrl,
  sceneImageUrl,
  onSetSceneImageUrl,
  onFav,
}: {
  mode: QuickWorkspaceMode
  modelImageUrl: string
  sceneImageUrl: string
  onSetSceneImageUrl: (v: string) => void
  onFav: () => void
}) {
  return (
    <section className="fashion-glass rounded-2xl p-3 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm md:text-xs font-semibold text-[var(--text-secondary)]">
          ④ 上传{mode === 'background' ? '干净背景图' : '含原人物的场景图'}
        </div>
        <FavButton disabled={!sceneImageUrl} onClick={onFav} />
      </div>
      <ImageUploadPicker
        label={mode === 'background' ? '背景图' : '场景图（含原人物）'}
        value={sceneImageUrl}
        onChange={onSetSceneImageUrl}
        sourceType="scene"
        helperText={mode === 'background'
          ? 'AI 会自动决定最佳站位与姿势'
          : !modelImageUrl
            ? 'AI 会保留原模特的脸和姿势，只替换为新衣服'
            : 'AI 会提取原人物的位置与姿势，替换成新模特与新衣服'}
      />
    </section>
  )
})

const OutputSettings = memo(function OutputSettings({
  aspectRatio,
  framing,
  device,
  onSetAspectRatio,
  onSetFraming,
  onSetDevice,
}: {
  aspectRatio: QuickWorkspaceAspectRatio
  framing: QuickWorkspaceFraming
  device: string
  onSetAspectRatio: (v: QuickWorkspaceAspectRatio) => void
  onSetFraming: (v: QuickWorkspaceFraming) => void
  onSetDevice: (v: string) => void
}) {
  const cameraPresetButtons = useMemo(
    () =>
      CAMERA_PRESETS.map((p) => ({ ...p, active: device === p.id })),
    [device],
  )
  const phonePresetButtons = useMemo(
    () =>
      PHONE_PRESETS.map((p) => ({ ...p, active: device === p.id })),
    [device],
  )

  return (
    <section className="fashion-glass rounded-2xl p-3 md:p-5">
      <div className="text-sm md:text-xs font-semibold text-[var(--text-secondary)] mb-3">⑤ 输出设置</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs md:text-xs font-semibold text-[var(--text-secondary)] mb-1.5">图片比例</label>
          <select
            value={aspectRatio}
            onChange={(e) => onSetAspectRatio(e.target.value as QuickWorkspaceAspectRatio)}
            className="w-full h-9 px-3 rounded-xl text-xs md:text-xs font-medium bg-[var(--bg-card)] border border-[var(--border-normal)] outline-none focus:border-[rgba(198,123,92,0.35)] text-[var(--text-primary)] appearance-none cursor-pointer"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b7355' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
          >
            {ASPECT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs md:text-xs font-semibold text-[var(--text-secondary)] mb-1.5">构图</label>
          <select
            value={framing}
            onChange={(e) => onSetFraming(e.target.value as QuickWorkspaceFraming)}
            className="w-full h-9 px-3 rounded-xl text-xs md:text-xs font-medium bg-[var(--bg-card)] border border-[var(--border-normal)] outline-none focus:border-[rgba(198,123,92,0.35)] text-[var(--text-primary)] appearance-none cursor-pointer"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b7355' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
          >
            {FRAMING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 拍摄模式 */}
      <div className="mt-4 pt-4 border-t border-[var(--border-light)]">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="text-xs md:text-xs font-semibold text-[var(--text-secondary)]">拍摄模式</div>
          <div className="text-xs md:text-xs text-[var(--text-quaternary)]">不同模式对应不同焦距、景深、光线氛围与构图节奏</div>
        </div>

        {/* 单反 */}
        <div className="mb-1.5 flex items-center gap-1.5">
          <Camera className="w-3 h-3 text-[var(--text-secondary)]" />
          <span className="text-xs md:text-xs font-semibold text-[var(--text-secondary)]">单反</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5 mb-3">
          {cameraPresetButtons.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSetDevice(p.id)}
              className="text-left p-2.5 rounded-2xl border transition-all"
              style={{
                borderColor: p.active ? 'rgba(198,123,92,0.5)' : 'rgba(139,115,85,0.12)',
                background: p.active ? 'var(--bg-active)' : 'var(--bg-muted)',
              }}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs md:text-xs font-semibold text-[var(--text-primary)]">{p.label}</span>
                {p.active && <Check className="w-3 h-3 text-[#c67b5c]" />}
              </div>
              <div className="text-xs md:text-xs text-[#c67b5c] font-mono mb-0.5">{p.specLine}</div>
              <div className="text-xs md:text-xs text-[var(--text-secondary)] leading-relaxed">{p.desc}</div>
            </button>
          ))}
        </div>

        {/* 手机 */}
        <div className="mb-1.5 flex items-center gap-1.5">
          <Smartphone className="w-3 h-3 text-[var(--text-secondary)]" />
          <span className="text-xs md:text-xs font-semibold text-[var(--text-secondary)]">手机</span>
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {phonePresetButtons.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSetDevice(p.id)}
              className="text-left p-2.5 rounded-2xl border transition-all"
              style={{
                borderColor: p.active ? 'rgba(198,123,92,0.5)' : 'rgba(139,115,85,0.12)',
                background: p.active ? 'var(--bg-active)' : 'var(--bg-muted)',
              }}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs md:text-xs font-semibold text-[var(--text-primary)]">{p.label}</span>
                {p.active && <Check className="w-3 h-3 text-[#c67b5c]" />}
              </div>
              <div className="text-xs md:text-xs text-[#c67b5c] font-mono mb-0.5">{p.specLine}</div>
              <div className="text-xs md:text-xs text-[var(--text-secondary)] leading-relaxed">{p.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
})

const ExtraPromptSection = memo(function ExtraPromptSection({
  extraPrompt,
  onSetExtraPrompt,
}: {
  extraPrompt: string
  onSetExtraPrompt: (v: string) => void
}) {
  return (
    <section className="fashion-glass rounded-2xl p-5">
      <div className="text-sm md:text-xs font-semibold text-[var(--text-secondary)] mb-2">⑥ 附加提示（可选）</div>
      <textarea
        value={extraPrompt}
        onChange={(e) => onSetExtraPrompt(e.target.value)}
        placeholder="添加你想要的姿势、色调等描述..."
        rows={3}
        className="w-full px-3 py-2 rounded-2xl text-sm md:text-sm bg-[var(--bg-card)] border border-[var(--border-normal)] outline-none focus:border-[rgba(198,123,92,0.35)] text-[var(--text-primary)] resize-none"
      />
    </section>
  )
})

const LookbookToggle = memo(function LookbookToggle({
  lookbookMode,
  onToggle,
}: {
  lookbookMode: boolean
  onToggle: () => void
}) {
  return (
    <section className="fashion-glass rounded-2xl p-3 md:p-5">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Grid3X3 className="w-4 h-4 text-[#c67b5c]" />
          <span className="text-sm md:text-xs font-semibold text-[var(--text-secondary)]">套图模式</span>
        </div>
        <div
          className="w-10 h-5.5 rounded-full transition-all relative"
          style={{
            background: lookbookMode ? 'linear-gradient(135deg, #c67b5c, #d4a882)' : 'rgba(139,115,85,0.15)',
          }}
        >
          <div
            className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all shadow-sm"
            style={{ left: lookbookMode ? '22px' : '2px' }}
          />
        </div>
      </button>
      {lookbookMode && (
        <div className="mt-2 text-xs md:text-xs text-[var(--text-secondary)] leading-relaxed">
          同一件衣服、同一个模特，生成多张不同姿势/场景的套图。适合一季 Look Book 拍摄。
        </div>
      )}
    </section>
  )
})

const ResultPanel = memo(function ResultPanel({
  currentTask,
  showLoading,
  resultUrl,
  failed,
  onDownload,
}: {
  currentTask: GenerationTask | null
  showLoading: boolean
  resultUrl: string
  failed: boolean
  onDownload: () => void
}) {
  const status = currentTask?.status
  return (
    <div className="lg:sticky lg:top-4 self-start w-full">
      <div className="fashion-glass rounded-2xl p-5 min-h-[520px] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm md:text-xs font-semibold text-[var(--text-secondary)]">生成结果</div>
          {currentTask && (
            <span className="text-xs md:text-xs px-2 py-0.5 rounded-full bg-[var(--bg-active)] text-[var(--text-secondary)]">{status}</span>
          )}
        </div>

        <div className="flex-1 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-muted)] flex items-center justify-center overflow-hidden p-4">
          {showLoading && !resultUrl && (
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#c67b5c] mx-auto mb-3" />
              <div className="text-sm md:text-xs text-[var(--text-secondary)] font-medium">
                {status === 'GENERATING' ? 'AI 正在合成图像...' : '任务准备中...'}
              </div>
            </div>
          )}
          {!showLoading && !resultUrl && !failed && (
            <div className="text-center text-[var(--text-extreme)]">
              <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-60" />
              <div className="text-sm md:text-xs">完成左侧配置后点击「一键生成」</div>
            </div>
          )}
          {failed && (
            <div className="text-center text-[#c47070]">
              <div className="text-sm md:text-sm font-semibold mb-1">生成失败</div>
              <div className="text-xs md:text-xs opacity-80">{currentTask?.errorMsg || '请重试或联系管理员'}</div>
            </div>
          )}
          {resultUrl && (
            <img src={resultUrl} alt="结果" className="max-w-full max-h-[560px] object-contain rounded-2xl" />
          )}
        </div>

        {resultUrl && (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onDownload}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-2xl border border-[var(--border-strong)] text-sm md:text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
            >
              <Download className="w-4 h-4" />下载
            </button>
          </div>
        )}
      </div>
    </div>
  )
})

// ─── Main component ─────────────────────────────────────────

export default function QuickWorkspaceContent() {
  // 直接从 store 读取工作台完整状态，mount 时 0 延迟
  const qw = useDraftStore((s) => s.qw)
  const setQw = useDraftStore((s) => s.setQw)
  const setQwBatch = useDraftStore((s) => s.setQwBatch)
  const resetQw = useDraftStore((s) => s.resetQw)

  // Backward compat: migrate legacy quickWorkspaceDraft into qw on first mount
  const quickDraft = useDraftStore((s) => s.quickWorkspaceDraft)
  const clearQuickDraft = useDraftStore((s) => s.clearQuickWorkspaceDraft)
  const migratedRef = useRef(false)
  useEffect(() => {
    if (migratedRef.current) return
    migratedRef.current = true
    if (quickDraft) {
      setQwBatch({
        mode: quickDraft.mode || 'background',
        clothingUrl: quickDraft.clothingUrl || '',
        clothingBackUrl: quickDraft.clothingBackUrl || '',
        modelImageUrl: quickDraft.modelImageUrl || '',
        sceneImageUrl: quickDraft.sceneImageUrl || '',
        extraPrompt: quickDraft.extraPrompt || '',
        aspectRatio: quickDraft.aspectRatio || '3:4',
        framing: quickDraft.framing || 'auto',
        device: quickDraft?.device && isValidDeviceId(quickDraft.device) ? quickDraft.device : 'phone',
      })
      clearQuickDraft()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { mode, clothingUrl, clothingBackUrl, modelImageUrl, sceneImageUrl, extraPrompt, aspectRatio, framing, device, lookbookMode } = qw

  // Stable setters via store
  const setMode = useCallback((v: QuickWorkspaceMode) => setQw('mode', v), [setQw])
  const setClothingUrl = useCallback((v: string) => setQw('clothingUrl', v), [setQw])
  const setClothingBackUrl = useCallback((v: string) => setQw('clothingBackUrl', v), [setQw])
  const setModelImageUrl = useCallback((v: string) => setQw('modelImageUrl', v), [setQw])
  const setSceneImageUrl = useCallback((v: string) => setQw('sceneImageUrl', v), [setQw])
  const setExtraPrompt = useCallback((v: string) => setQw('extraPrompt', v), [setQw])
  const setAspectRatio = useCallback((v: QuickWorkspaceAspectRatio) => setQw('aspectRatio', v), [setQw])
  const setFraming = useCallback((v: QuickWorkspaceFraming) => setQw('framing', v), [setQw])
  const setDevice = useCallback((v: string) => setQw('device', v), [setQw])
  const toggleLookbookMode = useCallback(() => {
    useDraftStore.setState((s) => ({ qw: { ...s.qw, lookbookMode: !s.qw.lookbookMode } }))
  }, [])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const qwGen = useGenerationStore((s) => s.quickWorkspace)
  const setQwGen = useGenerationStore((s) => s.setQuickWorkspaceGen)
  const [initialHydrated, setInitialHydrated] = useState(false)
  useEffect(() => {
    if (!initialHydrated) {
      if (qwGen.submitting) setSubmitting(qwGen.submitting)
      if (qwGen.error) setError(qwGen.error)
      setInitialHydrated(true)
    }
  }, [initialHydrated, qwGen])
  useEffect(() => {
    setQwGen({ submitting, error })
  }, [submitting, error, setQwGen])

  const [favDialog, setFavDialog] = useState<null | { type: FavoriteType; imageUrl: string; backUrl?: string; defaultName: string }>(null)
  const [favName, setFavName] = useState('')
  const [favSaving, setFavSaving] = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)

  const canSaveFullConfig = !!clothingUrl && !!modelImageUrl && !!sceneImageUrl

  const pollTask = useTaskStore((s) => s.pollTask)
  const currentTask = useTaskStore((s) => s.currentTask)
  const isPolling = useTaskStore((s) => s.isPolling)
  const setCurrentTask = useTaskStore((s) => s.setCurrentTask)
  const clearTask = useTaskStore((s) => s.clearTask)
  const updateCredits = useAuthStore((s) => s.updateCredits)
  const user = useAuthStore((s) => s.user)
  const credits = user?.credits ?? 0
  const addNotification = useNotificationStore((s) => s.add)

  const canSubmit = useMemo(() => {
    const modelOk = mode === 'fusion' || !!modelImageUrl
    return !!clothingUrl && modelOk && !!sceneImageUrl && !submitting && !isPolling && credits >= 1
  }, [clothingUrl, modelImageUrl, sceneImageUrl, mode, submitting, isPolling, credits])

  useEffect(() => {
    const task = useTaskStore.getState().currentTask
    if (task && !isTerminal(task.status) && !useTaskStore.getState().isPolling) {
      void pollTask(task.id).then((finished) => {
        if (finished?.status === 'COMPLETED') {
          addNotification({ type: 'success', message: '快速工作台生图完成' })
        } else if (finished?.status === 'FAILED') {
          addNotification({ type: 'error', message: finished.errorMsg || '生成失败' })
        }
        // 无论成功/失败都同步积分（失败时后端会退还）
        void workspaceApi.getBalance().then(updateCredits).catch(() => undefined)
      })
    }
    function isTerminal(status: string) {
      return status === 'COMPLETED' || status === 'FAILED'
    }
  }, [pollTask, addNotification, updateCredits])

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
        modelImageUrl: modelImageUrl || undefined,
        sceneImageUrl,
        mode,
        aspectRatio,
        framing,
        device,
        extraPrompt: extraPrompt.trim() || undefined,
      })
      setCurrentTask(task)
      void pollTask(task.id).then((finished) => {
        if (!finished) return
        if (finished.status === 'FAILED') {
          addNotification({ type: 'error', message: finished.errorMsg || '生成失败' })
        } else {
          addNotification({ type: 'success', message: '快速工作台生图完成' })
        }
        // 无论成功/失败都同步积分（失败时后端会退还）
        void workspaceApi.getBalance().then(updateCredits).catch(() => undefined)
        // 轮询结束后才解除提交锁定
        setSubmitting(false)
      })
    } catch (err) {
      setError(getErrorMessage(err, '提交失败，请重试'))
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
    resetQw()
    setError('')
  }, [clearTask, resetQw])

  const handleDownload = useCallback(async () => {
    if (!currentTask?.resultUrl) return
    try {
      const response = await fetch(currentTask.resultUrl)
      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `workspace-${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(downloadUrl)
    } catch {
      window.open(currentTask.resultUrl, '_blank')
    }
  }, [currentTask?.resultUrl])

  const status = currentTask?.status
  const showLoading = submitting || isPolling || (!!status && status !== 'COMPLETED' && status !== 'FAILED')
  const resultUrl = currentTask?.resultUrl && currentTask.status === 'COMPLETED' ? currentTask.resultUrl! : ''
  const failed = status === 'FAILED'

  return (
    <div className="w-full min-h-full">
      <div className="max-w-[1400px] mx-auto">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-2.5 mb-5">
          <div
            className="hidden w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #c67b5c, #d4a882)' }}
          >
            <Wand2 className="w-4 h-4 text-white" />
          </div>
          <h1 className="hidden text-lg font-bold tracking-tight text-[var(--text-primary)] flex-1">工作台</h1>
        </div>

        {/* 移动端：生成中/有结果时在顶部显示进度提示 */}
        {!lookbookMode && (showLoading || resultUrl) && (
          <div className="lg:hidden mb-4 p-3 rounded-2xl flex items-center gap-3" style={{ background: 'var(--bg-active)', border: '1px solid rgba(198,123,92,0.15)' }}>
            {showLoading && !resultUrl && <Loader2 className="w-4 h-4 animate-spin text-[#c67b5c] flex-shrink-0" />}
            {resultUrl && <img src={resultUrl} alt="结果" className="w-8 h-8 rounded-2xl object-cover flex-shrink-0" />}
            <span className="text-sm md:text-xs text-[var(--text-secondary)] font-medium">
              {showLoading && !resultUrl ? 'AI 正在合成图像...' : failed ? '生成失败，请重试' : '生成完成！向下滚动查看结果'}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_520px] gap-4 md:gap-6">
          {/* 左：配置 */}
          <div className="flex flex-col gap-4 md:gap-5">
            <ModeSelector mode={mode} onSetMode={setMode} />
            <ModelUploader mode={mode} modelImageUrl={modelImageUrl} onSetModelImageUrl={setModelImageUrl} onFav={() => openFavDialog('model')} />
            <ClothingUploader clothingUrl={clothingUrl} clothingBackUrl={clothingBackUrl} onSetClothingUrl={setClothingUrl} onSetClothingBackUrl={setClothingBackUrl} onFav={() => openFavDialog('clothing')} />
            <SceneUploader mode={mode} modelImageUrl={modelImageUrl} sceneImageUrl={sceneImageUrl} onSetSceneImageUrl={setSceneImageUrl} onFav={() => openFavDialog('scene')} />
            <OutputSettings aspectRatio={aspectRatio} framing={framing} device={device} onSetAspectRatio={setAspectRatio} onSetFraming={setFraming} onSetDevice={setDevice} />
            <ExtraPromptSection extraPrompt={extraPrompt} onSetExtraPrompt={setExtraPrompt} />
            <LookbookToggle lookbookMode={lookbookMode} onToggle={toggleLookbookMode} />

            {error && !lookbookMode && (
              <div className="px-4 py-3 rounded-2xl bg-[rgba(196,112,112,0.08)] border border-[rgba(196,112,112,0.2)] text-sm md:text-xs text-[#c47070]">{error}</div>
            )}

            {/* 普通模式：一键生成按钮 + 操作栏 */}
            {!lookbookMode && (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-2xl text-base md:text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #c67b5c, #d4a882)' }}
              >
                {submitting || isPolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {submitting ? '提交中...' : isPolling ? 'AI 合成中...' : credits < 1 ? '积分不足' : '一键生成'}
              </button>
              {credits < 1 && !submitting && !isPolling && (
                <div className="text-center text-xs md:text-xs text-[#c47070] font-medium">积分余额不足，无法生成。请联系管理员充值。</div>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => openFavDialog('full')}
                  disabled={!canSaveFullConfig}
                  title={canSaveFullConfig ? '把当前服装 + 模特 + 场景 + 参数整套打包到素材库' : '请先上传 服装 / 模特 / 场景 三张图'}
                  className="h-10 px-4 rounded-2xl border text-sm md:text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                  style={{
                    borderColor: canSaveFullConfig ? 'rgba(198,123,92,0.35)' : 'rgba(139,115,85,0.15)',
                    color: canSaveFullConfig ? '#c67b5c' : 'var(--text-quaternary)',
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
                    className="h-10 px-4 rounded-2xl border border-[rgba(139,115,85,0.2)] text-sm md:text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
                  >
                    <RefreshCw className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />重置结果
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setClearConfirm(true)}
                  className="h-10 px-4 rounded-2xl border border-[rgba(139,115,85,0.2)] text-sm md:text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
                  title="清空所有已上传的图片和表单"
                >
                  清空表单
                </button>
              </div>
            </div>
            )}

            {/* 套图模式：LookBookPanel */}
            {lookbookMode && (
              <LookBookPanel
                clothingUrl={clothingUrl}
                clothingBackUrl={clothingBackUrl}
                modelImageUrl={modelImageUrl}
                sceneImageUrl={sceneImageUrl}
                mode={mode}
                aspectRatio={aspectRatio}
                framing={framing}
                device={device}
                extraPrompt={extraPrompt}
                credits={credits}
              />
            )}
          </div>

          {/* 右：结果（仅普通模式） */}
          {!lookbookMode && (
            <ResultPanel
              currentTask={currentTask}
              showLoading={showLoading}
              resultUrl={resultUrl}
              failed={failed}
              onDownload={handleDownload}
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={clearConfirm}
        title="确认清空表单"
        description="将清空所有已上传的图片、参数和生成结果，此操作无法恢复。"
        confirmText="确认清空"
        zIndex={9999}
        icon={<X className="w-5 h-5 text-red-500" />}
        onConfirm={() => { handleClearAll(); setClearConfirm(false) }}
        onCancel={() => setClearConfirm(false)}
      />

      {/* 收藏到素材库 Dialog */}
      {favDialog && (
        <FavDialog
          favDialog={favDialog}
          favName={favName}
          favSaving={favSaving}
          mode={mode}
          clothingUrl={clothingUrl}
          modelImageUrl={modelImageUrl}
          sceneImageUrl={sceneImageUrl}
          aspectRatio={aspectRatio}
          framing={framing}
          device={device}
          setFavName={setFavName}
          closeFavDialog={closeFavDialog}
          handleSaveFavorite={handleSaveFavorite}
        />
      )}
    </div>
  )
}

// ─── Fav Dialog (extracted) ──────────────────────────────────

function FavDialogInner({
  favDialog,
  favName,
  favSaving,
  mode,
  clothingUrl,
  modelImageUrl,
  sceneImageUrl,
  aspectRatio,
  framing,
  device,
  setFavName,
  closeFavDialog,
  handleSaveFavorite,
}: {
  favDialog: { type: FavoriteType; imageUrl: string; backUrl?: string; defaultName: string }
  favName: string
  favSaving: boolean
  mode: QuickWorkspaceMode
  clothingUrl: string
  modelImageUrl: string
  sceneImageUrl: string
  aspectRatio: QuickWorkspaceAspectRatio
  framing: QuickWorkspaceFraming
  device: string
  setFavName: (v: string) => void
  closeFavDialog: () => void
  handleSaveFavorite: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={closeFavDialog}
    >
      <div
        className="w-full max-w-[400px] bg-[var(--bg-card)] rounded-2xl shadow-2xl border border-[var(--border-light)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {favDialog.type === 'full' ? <Layers className="w-4 h-4 text-[#c67b5c]" /> : <Star className="w-4 h-4 text-[#c67b5c]" />}
            <h3 className="text-base md:text-sm font-semibold text-[var(--text-primary)]">
              {favDialog.type === 'full' ? '收藏完整配置到素材库' : `收藏${favDialog.type === 'clothing' ? '服装' : favDialog.type === 'model' ? '模特' : '场景'}到素材库`}
            </h3>
          </div>
          <button
            type="button"
            onClick={closeFavDialog}
            disabled={favSaving}
            className="text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {favDialog.type === 'full' && (
          <div className="mb-3 p-3 rounded-2xl bg-[rgba(198,123,92,0.05)] border border-[rgba(198,123,92,0.12)]">
            <div className="text-xs md:text-xs font-semibold text-[var(--text-secondary)] mb-1.5">本次打包内容</div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {[
                { label: '服装', url: clothingUrl },
                { label: '模特', url: modelImageUrl },
                { label: '场景', url: sceneImageUrl },
              ].map((it) => (
                <div key={it.label} className="flex flex-col items-center gap-1">
                  <div className="w-full aspect-square rounded-2xl overflow-hidden border border-[var(--border-normal)] bg-[var(--bg-muted)]">
                    {it.url ? (
                      <img src={it.url} alt={it.label} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs md:text-xs text-[var(--text-extreme)]">无</div>
                    )}
                  </div>
                  <div className="text-xs md:text-xs text-[var(--text-secondary)]">{it.label}</div>
                </div>
              ))}
            </div>
            <div className="text-xs md:text-xs text-[var(--text-secondary)] leading-relaxed">
              <span className="mr-2">模式：{mode === 'background' ? '背景图' : '融合'}</span>
              <span className="mr-2">比例：{aspectRatio}</span>
              <span className="mr-2">构图：{framing === 'auto' ? '自动' : framing === 'half' ? '半身' : '全身'}</span>
              <span>设备：{device}</span>
            </div>
          </div>
        )}

        <div className="flex gap-3 mb-4">
          {favDialog.type !== 'full' && (
            <div className="w-20 h-20 rounded-2xl overflow-hidden border border-[var(--border-normal)] flex-shrink-0 bg-[var(--bg-muted)]">
              <img src={favDialog.imageUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <label className="block text-xs md:text-xs font-medium text-[var(--text-secondary)] mb-1.5">名称</label>
            <input
              type="text"
              value={favName}
              onChange={(e) => setFavName(e.target.value)}
              placeholder={favDialog.defaultName}
              disabled={favSaving}
              className="w-full h-10 px-3 rounded-2xl border border-[var(--border-strong)] bg-white text-sm md:text-sm text-[var(--text-primary)] outline-none focus:border-[rgba(198,123,92,0.4)] focus:ring-2 focus:ring-[rgba(198,123,92,0.08)] disabled:opacity-60"
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
            className="flex-1 h-10 rounded-2xl border border-[rgba(139,115,85,0.2)] text-sm md:text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] disabled:opacity-40"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => { void handleSaveFavorite() }}
            disabled={favSaving || !favName.trim()}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-2xl text-sm md:text-xs font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #c67b5c, #d4a882)' }}
          >
            {favSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {favSaving ? '保存中...' : '保存收藏'}
          </button>
        </div>
      </div>
    </div>
  )
}

const FavDialog = memo(FavDialogInner)

// ─── FavButton (shared) ──────────────────────────────────────

function FavButton({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={disabled ? '先上传图片再收藏' : '收藏到素材库'}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-2xl text-xs md:text-xs font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: disabled ? 'rgba(139,115,85,0.04)' : 'rgba(198,123,92,0.08)',
        color: disabled ? 'var(--text-quaternary)' : '#c67b5c',
        borderColor: disabled ? 'rgba(139,115,85,0.1)' : 'rgba(198,123,92,0.2)',
      }}
    >
      <Star className="w-3 h-3" />
      收藏
    </button>
  )
}
