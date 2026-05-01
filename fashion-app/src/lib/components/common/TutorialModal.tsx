'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle, X, ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react'

export interface TutorialStep {
  title: string
  content: string
  icon?: React.ReactNode
}

interface TutorialModalProps {
  id: string
  steps: TutorialStep[]
}

function useTutorialSeen(id: string) {
  const key = `tutorial-seen-${id}`
  const [seen, setSeen] = useState(true)

  useEffect(() => {
    setSeen(localStorage.getItem(key) === '1')
  }, [key])

  const markSeen = useCallback(() => {
    localStorage.setItem(key, '1')
    setSeen(true)
  }, [key])

  return { seen, markSeen }
}

export function TutorialButton({ id, steps }: TutorialModalProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const { seen, markSeen } = useTutorialSeen(id)

  useEffect(() => {
    if (!seen) setOpen(true)
  }, [seen])

  const handleClose = () => {
    setOpen(false)
    setStep(0)
    markSeen()
  }

  const next = () => {
    if (step < steps.length - 1) setStep(step + 1)
    else handleClose()
  }

  const prev = () => {
    if (step > 0) setStep(step - 1)
  }

  const current = steps[step]

  return (
    <>
      <button
        onClick={() => { setOpen(true); setStep(0) }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-medium transition-all"
        style={{
          color: 'var(--text-secondary)',
          background: 'var(--bg-muted)',
          border: '1px solid var(--border-normal)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(139,115,85,0.08)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(139,115,85,0.04)' }}
        title="使用教程"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">教程</span>
        {!seen && (
          <span className="w-1.5 h-1.5 bg-[#c67b5c] rounded-full" />
        )}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1100] flex items-center justify-center p-4" onClick={handleClose}>
          <div
            className="relative w-full max-w-[440px] bg-[var(--bg-card)] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Progress bar */}
            <div className="h-1 bg-[var(--bg-active)]">
              <div
                className="h-full transition-all duration-300 rounded-full"
                style={{
                  width: `${((step + 1) / steps.length) * 100}%`,
                  background: 'linear-gradient(135deg, #c67b5c, #d4a882)',
                }}
              />
            </div>

            {/* Close */}
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 w-7 h-7 rounded-2xl flex items-center justify-center text-[var(--text-quaternary)] hover:bg-[var(--bg-active)] transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Content */}
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #c67b5c, #d4a882)' }}
                >
                  {current.icon || <Lightbulb className="w-5 h-5 text-white" />}
                </div>
                <div>
                  <div className="text-xs text-[var(--text-quaternary)] font-semibold tracking-widest uppercase">
                    步骤 {step + 1} / {steps.length}
                  </div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] leading-tight">{current.title}</h3>
                </div>
              </div>
              <div className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-line min-h-[80px]">
                {current.content}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-light)]">
              <button
                onClick={prev}
                disabled={step === 0}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-2xl text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-active)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> 上一步
              </button>

              {/* Dots */}
              <div className="flex gap-1.5">
                {steps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    className="w-2 h-2 rounded-full transition-all"
                    style={{
                      background: i === step ? '#c67b5c' : 'rgba(139,115,85,0.15)',
                      transform: i === step ? 'scale(1.2)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>

              <button
                onClick={next}
                className="inline-flex items-center gap-1 px-4 py-1.5 rounded-2xl text-xs font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #c67b5c, #d4a882)' }}
              >
                {step === steps.length - 1 ? '知道了' : <>下一步 <ChevronRight className="w-3.5 h-3.5" /></>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
