'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { GenerationTask } from '@/lib/types'
import { LazyImage } from '@/lib/components/LazyImage'
import { X, GripVertical, ChevronLeft, ChevronRight, Columns2, Grid2x2 } from 'lucide-react'

interface ComparePanelProps {
  tasks: GenerationTask[]
  onClose: () => void
}

type Layout = 'side' | 'grid'

function getResultImages(task: GenerationTask): string[] {
  if (task.resultUrls && task.resultUrls.length > 0) return task.resultUrls
  if (task.resultUrl) return [task.resultUrl]
  return []
}

function TaskLabel({ task }: { task: GenerationTask }) {
  const typeLabels: Record<string, string> = {
    workspace: '工作台',
    'model-fusion': '模特合成',
    redesign: 'AI改款',
  }
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-black/40 backdrop-blur-md rounded-xl">
      <span className="text-[11px] font-semibold text-white/90">{typeLabels[task.type] || task.type}</span>
      <span className="text-[10px] text-white/50 font-mono">{task.id.slice(0, 6)}</span>
    </div>
  )
}

function ConfigDiff({ tasks }: { tasks: GenerationTask[] }) {
  const rows: { label: string; values: string[] }[] = []

  const get = (task: GenerationTask, path: string): string => {
    if (path === 'gender') return task.modelConfig?.gender || '-'
    if (path === 'bodyType') return task.modelConfig?.bodyType || '-'
    if (path === 'pose') return task.modelConfig?.pose || '-'
    if (path === 'expression') return task.modelConfig?.expression || '-'
    if (path === 'category') return task.modelConfig?.category || '-'
    if (path === 'preset') return task.sceneConfig?.preset || '-'
    if (path === 'lighting') return task.sceneConfig?.lighting || '-'
    if (path === 'aspectRatio') return task.sceneConfig?.aspectRatio || '-'
    return '-'
  }

  const fields = [
    { key: 'gender', label: '性别' },
    { key: 'bodyType', label: '体型' },
    { key: 'pose', label: '姿势' },
    { key: 'expression', label: '表情' },
    { key: 'preset', label: '场景' },
    { key: 'lighting', label: '光线' },
    { key: 'aspectRatio', label: '比例' },
  ]

  for (const f of fields) {
    const vals = tasks.map((t) => get(t, f.key))
    const allSame = vals.every((v) => v === vals[0])
    if (!allSame || vals[0] !== '-') {
      rows.push({ label: f.label, values: vals })
    }
  }

  if (rows.length === 0) return null

  return (
    <div className="fashion-glass rounded-2xl p-4 mt-4">
      <h4 className="text-[12px] font-semibold text-[#8b7355] uppercase tracking-wider mb-3">参数差异</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr>
              <th className="text-left text-[#b0a59a] font-semibold pb-2 pr-4 whitespace-nowrap">参数</th>
              {tasks.map((t, i) => (
                <th key={i} className="text-left text-[#b0a59a] font-semibold pb-2 pr-4 whitespace-nowrap">
                  图 {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const allSame = row.values.every((v) => v === row.values[0])
              return (
                <tr key={row.label}>
                  <td className="py-1.5 pr-4 text-[#8b7355] font-medium whitespace-nowrap">{row.label}</td>
                  {row.values.map((v, i) => (
                    <td
                      key={i}
                      className={`py-1.5 pr-4 whitespace-nowrap ${
                        allSame ? 'text-[#b0a59a]' : 'text-[#c67b5c] font-semibold'
                      }`}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SliderCompare({ imgA, imgB }: { imgA: string; imgB: string }) {
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

  const onPointerUp = useCallback(() => {
    dragging.current = false
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden cursor-col-resize select-none touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Right image (full) */}
      <img src={imgB} alt="对比B" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      {/* Left image (clipped) */}
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        <img src={imgA} alt="对比A" className="absolute inset-0 w-full h-full object-cover" style={{ minWidth: containerRef.current ? `${containerRef.current.offsetWidth}px` : '100%' }} draggable={false} />
      </div>
      {/* Slider line */}
      <div className="absolute top-0 bottom-0 w-[3px] bg-white shadow-lg z-10" style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-xl flex items-center justify-center">
          <GripVertical className="w-4 h-4 text-[#8b7355]" />
        </div>
      </div>
      {/* Labels */}
      <div className="absolute top-3 left-3 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10">A</div>
      <div className="absolute top-3 right-3 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10">B</div>
    </div>
  )
}

export function ComparePanel({ tasks, onClose }: ComparePanelProps) {
  const [layout, setLayout] = useState<Layout>(tasks.length === 2 ? 'side' : 'grid')
  const [selectedImgIdx, setSelectedImgIdx] = useState<number[]>(tasks.map(() => 0))
  const [sliderMode, setSliderMode] = useState(false)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const allImages = tasks.map((t) => getResultImages(t))

  const switchImg = (taskIdx: number, delta: number) => {
    setSelectedImgIdx((prev) => {
      const next = [...prev]
      const imgs = allImages[taskIdx]
      next[taskIdx] = (next[taskIdx] + delta + imgs.length) % imgs.length
      return next
    })
  }

  const showSlider = tasks.length === 2 && sliderMode
  const imgA = allImages[0]?.[selectedImgIdx[0]] || ''
  const imgB = allImages[1]?.[selectedImgIdx[1]] || ''

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[900] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-white/90 backdrop-blur-xl border-b border-[rgba(139,115,85,0.08)]">
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-bold text-[#2d2422]">对比模式</h2>
          <span className="text-[11px] text-[#b0a59a]">{tasks.length} 张结果</span>
        </div>
        <div className="flex items-center gap-2">
          {tasks.length === 2 && (
            <button
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all ${
                sliderMode
                  ? 'bg-[#c67b5c] text-white'
                  : 'text-[#8b7355] bg-[rgba(139,115,85,0.04)] border border-[rgba(139,115,85,0.1)] hover:bg-[rgba(139,115,85,0.08)]'
              }`}
              onClick={() => setSliderMode(!sliderMode)}
            >
              <Columns2 className="w-3.5 h-3.5" />
              滑动对比
            </button>
          )}
          {!sliderMode && tasks.length > 2 && (
            <div className="flex rounded-xl overflow-hidden border border-[rgba(139,115,85,0.1)]">
              <button
                className={`px-2.5 py-1.5 text-[11px] font-medium transition-all ${layout === 'side' ? 'bg-[#c67b5c] text-white' : 'text-[#8b7355] bg-[rgba(139,115,85,0.04)] hover:bg-[rgba(139,115,85,0.08)]'}`}
                onClick={() => setLayout('side')}
              >
                <Columns2 className="w-3.5 h-3.5" />
              </button>
              <button
                className={`px-2.5 py-1.5 text-[11px] font-medium transition-all ${layout === 'grid' ? 'bg-[#c67b5c] text-white' : 'text-[#8b7355] bg-[rgba(139,115,85,0.04)] hover:bg-[rgba(139,115,85,0.08)]'}`}
                onClick={() => setLayout('grid')}
              >
                <Grid2x2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <button
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#8b7355] hover:bg-[rgba(139,115,85,0.08)] transition-all"
            onClick={onClose}
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {showSlider && imgA && imgB ? (
          <div className="max-w-[600px] mx-auto">
            <SliderCompare imgA={imgA} imgB={imgB} />
            <div className="flex justify-between mt-3">
              {tasks.slice(0, 2).map((t) => (
                <TaskLabel key={t.id} task={t} />
              ))}
            </div>
            <ConfigDiff tasks={tasks} />
          </div>
        ) : (
          <>
            <div
              className={`${
                layout === 'grid'
                  ? 'grid grid-cols-2 md:grid-cols-3 gap-4'
                  : 'flex gap-4 overflow-x-auto pb-2'
              }`}
            >
              {tasks.map((task, tIdx) => {
                const imgs = allImages[tIdx]
                const currentIdx = selectedImgIdx[tIdx] || 0
                const currentImg = imgs[currentIdx]
                if (!currentImg) return null

                return (
                  <div
                    key={task.id}
                    className={`flex-shrink-0 flex flex-col ${layout === 'side' ? 'min-w-[220px] max-w-[320px] flex-1' : ''}`}
                  >
                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-[rgba(139,115,85,0.1)] bg-[rgba(139,115,85,0.02)]">
                      <LazyImage src={currentImg} alt={`对比 ${tIdx + 1}`} />
                      {/* Image switcher */}
                      {imgs.length > 1 && (
                        <>
                          <button
                            className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white z-10 transition-all"
                            onClick={() => switchImg(tIdx, -1)}
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white z-10 transition-all"
                            onClick={() => switchImg(tIdx, 1)}
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/40 text-white text-[9px] font-bold px-2 py-0.5 rounded-full z-10">
                            {currentIdx + 1} / {imgs.length}
                          </div>
                        </>
                      )}
                      {/* Index badge */}
                      <div className="absolute top-2 left-2 z-10">
                        <TaskLabel task={task} />
                      </div>
                    </div>
                    {/* Config summary */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {task.modelConfig?.pose && (
                        <span className="px-2 py-0.5 bg-[rgba(198,123,92,0.06)] text-[#c67b5c] text-[9px] font-medium rounded-full">{task.modelConfig.pose.split('（')[0]}</span>
                      )}
                      {task.sceneConfig?.preset && (
                        <span className="px-2 py-0.5 bg-[rgba(125,155,118,0.06)] text-[#7d9b76] text-[9px] font-medium rounded-full">{task.sceneConfig.preset.split('（')[0]}</span>
                      )}
                      {task.sceneConfig?.aspectRatio && (
                        <span className="px-2 py-0.5 bg-[rgba(139,115,85,0.06)] text-[#8b7355] text-[9px] font-medium rounded-full">{task.sceneConfig.aspectRatio}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <ConfigDiff tasks={tasks} />
          </>
        )}
      </div>
    </div>
  )
}
