'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Image as ImageIcon, Download, Check, X, Grid3X3, ChevronDown, ChevronUp } from 'lucide-react'
import { workspaceApi } from '@/lib/api/workspace'
import { useTaskStore } from '@/lib/stores/taskStore'
import { useAuthStore } from '@/lib/stores/authStore'
import { useNotificationStore } from '@/lib/stores/notificationStore'
import { getErrorMessage } from '@/lib/utils/api'
import type { GenerationTask, QuickWorkspaceAspectRatio, QuickWorkspaceFraming, QuickWorkspaceMode } from '@/lib/types'
import {
  findPoseById,
  getDefaultSelectedPoses,
  BATCH_COUNT_OPTIONS,
  BATCH_VARIATION_OPTIONS,
  type BatchVariationType,
  type PoseCategory,
  type PosePreset,
} from './pose-presets'

// ─── Props（从 quick-workspace 页面传入，共享已有配置） ───
export interface LookBookPanelProps {
  clothingUrl: string
  clothingBackUrl: string
  /** 融合模式下可选：不传则保留场景图中的原模特，仅换衣服 */
  modelImageUrl: string
  sceneImageUrl: string
  mode: QuickWorkspaceMode
  aspectRatio: QuickWorkspaceAspectRatio
  framing: QuickWorkspaceFraming
  device: string
  extraPrompt: string
  /** 当前积分余额，用于前端提示 */
  credits: number
}

// ─── 单张结果状态 ───
interface ResultItem {
  taskId: string
  task?: GenerationTask
  status: 'pending' | 'processing' | 'completed' | 'failed'
  resultUrl?: string
  error?: string
  poseLabel?: string
}

export function LookBookPanel({
  clothingUrl,
  clothingBackUrl,
  modelImageUrl,
  sceneImageUrl,
  mode,
  aspectRatio,
  framing,
  device,
  extraPrompt,
  credits,
}: LookBookPanelProps) {
  // ─── 姿势预设数据（从 API 加载） ───
  const [poseCategories, setPoseCategories] = useState<PoseCategory[]>([])
  const [posesLoading, setPosesLoading] = useState(true)

  // ─── 套图配置 ───
  const [variation, setVariation] = useState<BatchVariationType>('pose')
  const [count, setCount] = useState(3)
  const [selectedPoses, setSelectedPoses] = useState<string[]>([])
  const [showPosePicker, setShowPosePicker] = useState(false)
  const [activeCategory, setActiveCategory] = useState('daily')

  // ─── 生成状态 ───
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<ResultItem[]>([])
  const [error, setError] = useState('')

  // ─── 全局 stores ───
  const updateCredits = useAuthStore((s) => s.updateCredits)
  const addNotification = useNotificationStore((s) => s.add)
  const pollBatchTasks = useTaskStore((s) => s.pollBatchTasks)
  const setBatchTasks = useTaskStore((s) => s.setBatchTasks)
  const clearBatch = useTaskStore((s) => s.clearBatch)

  // ─── 加载姿势预设 ───
  useEffect(() => {
    let cancelled = false
    setPosesLoading(true)
    workspaceApi.getPosePresets()
      .then((cats) => {
        if (cancelled) return
        setPoseCategories(cats)
        if (cats.length > 0) {
          setActiveCategory(cats[0].id)
          setSelectedPoses(getDefaultSelectedPoses(cats))
        }
      })
      .catch(() => {
        if (cancelled) return
        // 加载失败时使用空数据
        setPoseCategories([])
      })
      .finally(() => {
        if (!cancelled) setPosesLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const canSubmit = useMemo(() => {
    const modelOk = mode === 'fusion' || !!modelImageUrl
    return !!clothingUrl && modelOk && !!sceneImageUrl && !submitting && credits >= count
  }, [clothingUrl, modelImageUrl, sceneImageUrl, mode, submitting, credits, count])

  // ─── 姿势选择 ───
  const togglePose = useCallback((poseId: string) => {
    setSelectedPoses((prev) =>
      prev.includes(poseId) ? prev.filter((id) => id !== poseId) : [...prev, poseId]
    )
  }, [])

  // ─── 提交套图 ───
  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return
    setError('')
    setSubmitting(true)
    setResults([])
    clearBatch()

    try {
      // 根据选择的姿势生成 poseHints
      const poseHints = selectedPoses.length > 0
        ? Array.from({ length: count }, (_, i) => {
            const preset = findPoseById(poseCategories, selectedPoses[i % selectedPoses.length])
            return preset?.prompt || ''
          })
        : []

      const res = await workspaceApi.createLookBookBatch({
        clothingUrl,
        clothingBackUrl: clothingBackUrl || undefined,
        modelImageUrl: modelImageUrl || undefined,
        sceneImageUrl,
        mode,
        aspectRatio,
        framing,
        device,
        extraPrompt: extraPrompt.trim() || undefined,
        batchVariation: variation,
        poseHints,
        count,
      })

      // 初始化结果列表
      const initialResults: ResultItem[] = res.taskIds.map((taskId, i) => ({
        taskId,
        status: 'pending',
        poseLabel: selectedPoses[i % selectedPoses.length]
          ? findPoseById(poseCategories, selectedPoses[i % selectedPoses.length])?.label || `姿势 ${i + 1}`
          : `第 ${i + 1} 张`,
      }))
      setResults(initialResults)

      // 更新积分
      void workspaceApi.getBalance().then(updateCredits).catch(() => undefined)

      // 批量轮询
      const batchResult = await pollBatchTasks(res.taskIds)

      // 更新结果
      setResults((prev) =>
        prev.map((item) => {
          const task = batchResult.find((t) => t.id === item.taskId)
          if (!task) return item
          const status = task.status === 'COMPLETED'
            ? 'completed' as const
            : task.status === 'FAILED'
            ? 'failed' as const
            : 'processing' as const
          return {
            ...item,
            task,
            status,
            resultUrl: task.resultUrl || undefined,
            error: task.errorMsg || undefined,
          }
        })
      )

      // 最终更新积分
      void workspaceApi.getBalance().then(updateCredits).catch(() => undefined)

      const successCount = batchResult.filter((t) => t.status === 'COMPLETED').length
      const failCount = batchResult.filter((t) => t.status === 'FAILED').length

      if (failCount === 0) {
        addNotification({ type: 'success', message: `套图生成完成，共 ${successCount} 张` })
      } else {
        addNotification({ type: 'error', message: `套图完成 ${successCount} 张，失败 ${failCount} 张` })
      }
    } catch (err) {
      setError(getErrorMessage(err, '套图提交失败，请重试'))
      // 失败时同步积分（后端可能已退还）
      void workspaceApi.getBalance().then(updateCredits).catch(() => undefined)
    } finally {
      setSubmitting(false)
    }
  }, [
    canSubmit, clothingUrl, clothingBackUrl, modelImageUrl, sceneImageUrl,
    mode, aspectRatio, framing, device, extraPrompt, variation, count,
    selectedPoses, poseCategories, clearBatch, pollBatchTasks, updateCredits, addNotification,
  ])

  // ─── 下载单张 ───
  const handleDownload = useCallback((url: string, index: number) => {
    const a = document.createElement('a')
    a.href = url
    a.download = `lookbook-${index + 1}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [])

  // ─── 批量下载 ───
  const handleBatchDownload = useCallback(async () => {
    const completedIds = results.filter((r) => r.status === 'completed' && r.taskId).map((r) => r.taskId)
    if (completedIds.length === 0) return
    try {
      await workspaceApi.downloadBatchZip(completedIds)
    } catch (err) {
      addNotification({ type: 'error', message: getErrorMessage(err, '下载失败') })
    }
  }, [results, addNotification])

  // ─── 进度统计 ───
  const completedCount = results.filter((r) => r.status === 'completed').length
  const failedCount = results.filter((r) => r.status === 'failed').length
  const processingCount = results.filter((r) => r.status === 'processing' || r.status === 'pending').length
  const isGenerating = submitting || processingCount > 0
  const allDone = results.length > 0 && processingCount === 0

  return (
    <div className="flex flex-col gap-4">
      {/* ── 套图配置区 ── */}
      <section className="fashion-glass rounded-2xl p-3 md:p-5">
        <div className="text-[12px] font-semibold text-[#8b7355] mb-3 flex items-center gap-1.5">
          <Grid3X3 className="w-3.5 h-3.5" />
          套图模式
        </div>

        {/* 变体类型 */}
        <div className="mb-4">
          <div className="text-[11px] font-semibold text-[#8b7355] mb-2">变化维度</div>
          <div className="grid grid-cols-3 gap-2">
            {BATCH_VARIATION_OPTIONS.map((opt) => {
              const active = variation === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVariation(opt.value)}
                  className="text-left p-3 rounded-lg border transition-all"
                  style={{
                    borderColor: active ? 'rgba(198,123,92,0.5)' : 'rgba(139,115,85,0.12)',
                    background: active ? 'rgba(198,123,92,0.06)' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  <div className="text-[12px] font-semibold text-[#2d2422] mb-0.5">{opt.label}</div>
                  <div className="text-[10px] text-[#8b7355] leading-relaxed">{opt.desc}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 生成数量 */}
        <div className="mb-4">
          <div className="text-[11px] font-semibold text-[#8b7355] mb-2">生成数量</div>
          <div className="flex gap-2">
            {BATCH_COUNT_OPTIONS.map((opt) => {
              const active = count === opt.value
              const insufficient = credits < opt.creditCost
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCount(opt.value)}
                  disabled={insufficient}
                  className="px-4 py-2 rounded-lg text-[12px] font-medium transition-all border disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: active ? 'linear-gradient(135deg, #c67b5c, #d4a882)' : 'rgba(139,115,85,0.03)',
                    color: active ? '#fff' : '#8b7355',
                    borderColor: active ? 'transparent' : 'rgba(139,115,85,0.12)',
                  }}
                >
                  {opt.label}
                  <span className="ml-1 text-[10px] opacity-70">{opt.creditCost} 积分</span>
                </button>
              )
            })}
          </div>
          {credits < count && (
            <div className="mt-1.5 text-[10px] text-[#c47070]">积分不足，需要 {count} 积分，当前 {credits} 积分</div>
          )}
        </div>

        {/* 姿势选择（仅 pose/both 变体时显示） */}
        {(variation === 'pose' || variation === 'both') && (
          <div>
            <button
              type="button"
              onClick={() => setShowPosePicker(!showPosePicker)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8b7355] mb-2 hover:text-[#c67b5c] transition-colors"
            >
              选择姿势预设
              {showPosePicker ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {selectedPoses.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[rgba(198,123,92,0.1)] text-[#c67b5c] text-[10px]">
                  {selectedPoses.length}
                </span>
              )}
            </button>
            {showPosePicker && (
              <div>
                {posesLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-4 h-4 animate-spin text-[#c67b5c] mr-2" />
                    <span className="text-[11px] text-[#8b7355]">加载姿势预设...</span>
                  </div>
                ) : poseCategories.length === 0 ? (
                  <div className="text-center py-6 text-[11px] text-[#b0a59a]">暂无姿势预设，请联系管理员添加</div>
                ) : (
                  <>
                    {/* 分类 Tab */}
                    <div className="flex gap-1.5 mb-3">
                      {poseCategories.map((cat) => {
                        const active = activeCategory === cat.id
                        const catSelectedCount = cat.poses.filter((p) => selectedPoses.includes(p.id)).length
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setActiveCategory(cat.id)}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border inline-flex items-center gap-1"
                            style={{
                              background: active ? 'rgba(198,123,92,0.08)' : 'rgba(139,115,85,0.02)',
                              color: active ? '#c67b5c' : '#8b7355',
                              borderColor: active ? 'rgba(198,123,92,0.25)' : 'rgba(139,115,85,0.1)',
                            }}
                          >
                            {cat.label}
                            {catSelectedCount > 0 && (
                              <span className="px-1 py-0 rounded-full bg-[rgba(198,123,92,0.12)] text-[#c67b5c] text-[9px] leading-[14px] min-w-[14px] text-center">
                                {catSelectedCount}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {/* 当前分类的姿势列表 */}
                    {(() => {
                      const cat = poseCategories.find((c) => c.id === activeCategory)
                      if (!cat || cat.poses.length === 0) return <div className="text-[11px] text-[#b0a59a] py-3">该分类暂无姿势</div>
                      return (
                        <div className="grid grid-cols-3 gap-2">
                          {cat.poses.map((pose) => {
                            const active = selectedPoses.includes(pose.id)
                            return (
                              <button
                                key={pose.id}
                                type="button"
                                onClick={() => togglePose(pose.id)}
                                className="text-left p-1.5 rounded-lg border transition-all"
                                style={{
                                  borderColor: active ? 'rgba(198,123,92,0.5)' : 'rgba(139,115,85,0.12)',
                                  background: active ? 'rgba(198,123,92,0.06)' : 'rgba(255,255,255,0.5)',
                                }}
                              >
                                {/* 缩略图 3:4 比例 */}
                                {pose.thumbnailUrl ? (
                                  <img
                                    src={pose.thumbnailUrl}
                                    alt={pose.label}
                                    className="w-full aspect-[3/4] object-cover rounded-md mb-1"
                                  />
                                ) : (
                                  <div className="w-full aspect-[3/4] rounded-md mb-1 bg-[rgba(139,115,85,0.06)] flex items-center justify-center">
                                    <ImageIcon className="w-3 h-3 text-[#c9bfb5]" />
                                  </div>
                                )}
                                <div className="flex items-center gap-0.5">
                                  {active && <Check className="w-2.5 h-2.5 text-[#c67b5c] flex-shrink-0" />}
                                  <span className={`text-[10px] font-medium leading-tight truncate ${active ? 'text-[#c67b5c]' : 'text-[#2d2422]'}`}>
                                    {pose.label}
                                  </span>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── 提交按钮 ── */}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-[rgba(196,112,112,0.08)] border border-[rgba(196,112,112,0.2)] text-[12px] text-[#c47070]">{error}</div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl text-[14px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: 'linear-gradient(135deg, #c67b5c, #d4a882)' }}
      >
        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Grid3X3 className="w-4 h-4" />}
        {submitting ? '提交中...' : isGenerating ? `生成中 (${completedCount}/${results.length})` : `生成套图 · ${count} 张`}
      </button>

      {/* ── 进度条 ── */}
      {isGenerating && results.length > 0 && (
        <div className="w-full h-2 rounded-full bg-[rgba(139,115,85,0.08)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(completedCount / results.length) * 100}%`,
              background: 'linear-gradient(135deg, #c67b5c, #d4a882)',
            }}
          />
        </div>
      )}

      {/* ── 结果网格 ── */}
      {results.length > 0 && (
        <section className="fashion-glass rounded-2xl p-3 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] font-semibold text-[#8b7355]">
              套图结果 {allDone && `(${completedCount}/${results.length})`}
            </div>
            {completedCount > 1 && (
              <button
                type="button"
                onClick={handleBatchDownload}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-[rgba(139,115,85,0.18)] text-[#8b7355] hover:bg-[rgba(139,115,85,0.04)]"
              >
                <Download className="w-3 h-3" />批量下载
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {results.map((item, i) => (
              <div
                key={item.taskId}
                className="relative group rounded-xl border border-[rgba(139,115,85,0.12)] overflow-hidden bg-[rgba(139,115,85,0.02)]"
              >
                {/* 姿势标签 */}
                {item.poseLabel && (
                  <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md bg-black/50 text-[10px] text-white backdrop-blur-sm">
                    {item.poseLabel}
                  </div>
                )}

                {/* 序号 */}
                <div className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-black/50 text-[10px] text-white flex items-center justify-center backdrop-blur-sm">
                  {i + 1}
                </div>

                {item.status === 'completed' && item.resultUrl ? (
                  <>
                    <img
                      src={item.resultUrl}
                      alt={`套图 ${i + 1}`}
                      className="w-full aspect-[3/4] object-cover"
                    />
                    {/* hover 下载按钮 */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleDownload(item.resultUrl!, i)}
                        className="px-3 py-1.5 rounded-lg bg-white/90 text-[11px] font-medium text-[#2d2422] hover:bg-white transition-colors inline-flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />下载
                      </button>
                    </div>
                  </>
                ) : item.status === 'failed' ? (
                  <div className="w-full aspect-[3/4] flex items-center justify-center text-[#c47070]">
                    <div className="text-center px-3">
                      <X className="w-5 h-5 mx-auto mb-1" />
                      <div className="text-[10px]">生成失败</div>
                      {item.error && <div className="text-[9px] opacity-70 mt-0.5">{item.error}</div>}
                    </div>
                  </div>
                ) : (
                  <div className="w-full aspect-[3/4] flex items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="w-5 h-5 animate-spin text-[#c67b5c] mx-auto mb-1" />
                      <div className="text-[10px] text-[#8b7355]">
                        {item.status === 'pending' ? '等待中...' : '生成中...'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 空状态 ── */}
      {results.length === 0 && !isGenerating && (
        <div className="fashion-glass rounded-2xl p-5 min-h-[280px] flex items-center justify-center">
          <div className="text-center text-[#c9bfb5]">
            <Grid3X3 className="w-10 h-10 mx-auto mb-2 opacity-60" />
            <div className="text-[12px]">配置好姿势和数量后点击「生成套图」</div>
            <div className="text-[10px] mt-1 opacity-70">同一件衣服，多个角度/动作的成片组</div>
          </div>
        </div>
      )}
    </div>
  )
}
