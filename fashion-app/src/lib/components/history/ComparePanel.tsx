'use client'

import { useState, useCallback, useEffect } from 'react'
import type { GenerationTask } from '@/lib/types'
import { LazyImage } from '@/lib/components/LazyImage'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface ComparePanelProps {
  tasks: GenerationTask[]
  onClose: () => void
}

function getResultImages(task: GenerationTask): string[] {
  if (task.resultUrls && task.resultUrls.length > 0) return task.resultUrls
  if (task.resultUrl) return [task.resultUrl]
  return []
}

export function ComparePanel({ tasks, onClose }: ComparePanelProps) {
  const [selectedImgIdx, setSelectedImgIdx] = useState<number[]>(tasks.map(() => 0))

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const allImages = tasks.map((t) => getResultImages(t))

  const switchImg = useCallback((taskIdx: number, delta: number) => {
    setSelectedImgIdx((prev) => {
      const next = [...prev]
      const imgs = allImages[taskIdx]
      if (!imgs || imgs.length === 0) return prev
      next[taskIdx] = (next[taskIdx] + delta + imgs.length) % imgs.length
      return next
    })
  }, [allImages])

  const gridCols = tasks.length <= 2
    ? 'grid-cols-2'
    : tasks.length === 3
      ? 'grid-cols-2 md:grid-cols-3'
      : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[900] flex flex-col">
      {/* Close button only */}
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭对比"
        className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-white flex items-center justify-center transition-all"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Pure image grid */}
      <div className="flex-1 overflow-auto p-3 md:p-6">
        <div className={`grid ${gridCols} gap-2 md:gap-3 max-w-[1400px] mx-auto`}>
          {tasks.map((task, tIdx) => {
            const imgs = allImages[tIdx]
            const currentIdx = selectedImgIdx[tIdx] || 0
            const currentImg = imgs[currentIdx]
            if (!currentImg) return null

            return (
              <div
                key={task.id}
                className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-black/40"
              >
                <LazyImage src={currentImg} alt="" />
                {imgs.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="上一张"
                      className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white z-10 transition-all"
                      onClick={(e) => { e.stopPropagation(); switchImg(tIdx, -1) }}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="下一张"
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white z-10 transition-all"
                      onClick={(e) => { e.stopPropagation(); switchImg(tIdx, 1) }}
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
