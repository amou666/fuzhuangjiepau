'use client'

import { AlertCircle } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmText: string
  cancelText?: string
  confirmVariant?: 'danger' | 'primary'
  icon?: React.ReactNode
  zIndex?: number
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText,
  cancelText = '取消',
  confirmVariant = 'danger',
  icon,
  zIndex = 1000,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  const isDanger = confirmVariant === 'danger'

  return (
    <div
      className="fixed inset-0 flex items-center justify-center backdrop-blur-sm px-4"
      style={{ background: 'rgba(0,0,0,0.5)', zIndex }}
      onClick={onCancel}
    >
      <div
        className="relative max-w-[380px] w-full rounded-2xl border p-6 shadow-2xl"
        style={{
          background: 'rgba(255,255,255,0.95)',
          borderColor: 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(40px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(196,112,112,0.08)' }}
          >
            {icon || <AlertCircle className="w-5 h-5 text-red-500" />}
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        </div>
        <p className="text-sm text-[var(--text-tertiary)] mb-5 leading-relaxed">{description}</p>
        <div className="flex gap-3">
          <button
            className="flex-1 py-2.5 rounded-2xl text-sm font-medium transition-all"
            style={{
              background: 'var(--bg-muted)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-light)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-active)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-muted)'
            }}
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            className="flex-1 py-2.5 rounded-2xl text-sm font-medium text-white transition-all active:scale-95"
            style={{
              background: isDanger ? '#ef4444' : 'linear-gradient(135deg, #c67b5c, #d4a882)',
            }}
            onMouseEnter={(e) => {
              if (isDanger) e.currentTarget.style.background = '#dc2626'
            }}
            onMouseLeave={(e) => {
              if (isDanger) e.currentTarget.style.background = '#ef4444'
            }}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
