export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
      <div className="flex items-center gap-3">
        <div
          className="w-5 h-5 border-2 rounded-full animate-spin"
          style={{ borderColor: 'rgba(198,123,92,0.2)', borderTopColor: '#c67b5c' }}
        />
        <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>加载中...</span>
      </div>
    </div>
  )
}
