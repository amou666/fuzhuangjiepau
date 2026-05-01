'use client'

import { useEffect } from 'react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AdminError]', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
      <div className="text-center px-6" style={{ maxWidth: 400 }}>
        <div
          className="text-6xl font-bold mb-4"
          style={{ color: 'var(--color-danger)' }}
        >
          !
        </div>
        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          管理页面加载失败
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          {error.message || '页面渲染时发生错误，请重试。'}
        </p>
        <button
          onClick={reset}
          className="px-6 py-2.5 rounded-2xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
          }}
        >
          重新加载
        </button>
      </div>
    </div>
  )
}
