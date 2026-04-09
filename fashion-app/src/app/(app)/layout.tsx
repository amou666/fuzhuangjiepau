'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { GlobalNotifications } from '@/lib/components/GlobalNotifications'
import { useAuthStore } from '@/lib/stores/authStore'
import { useHydrated } from '@/lib/hooks/useHydrated'
import { useTaskSse } from '@/lib/hooks/useTaskSse'

const menuItems = [
  { to: '/workspace', label: '工作台', icon: '✨' },
  { to: '/model-fusion', label: '模特合成', icon: '🎭' },
  { to: '/history', label: '历史记录', icon: '📷' },
  { to: '/profile', label: '账户设置', icon: '⚙️' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const user = useAuthStore((state) => state.user)
  const hydrated = useHydrated()
  const credits = useAuthStore((state) => state.user?.credits ?? 0)
  const clearSession = useAuthStore((state) => state.clearSession)

  useTaskSse()

  useEffect(() => {
    if (hydrated && !user) {
      router.push('/login')
    }
  }, [user, hydrated, router])

  if (!hydrated || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', color: '#fff' }}>
        <div>加载中...</div>
      </div>
    )
  }

  return (
    <div className="app-layout">
      <GlobalNotifications />
      <aside className="app-sidebar">
        <div className="app-sidebar-header">
          <div className="app-logo">
            <div className="app-logo-icon">✨</div>
            <div className="app-logo-text">Fashion AI</div>
          </div>
        </div>
        <div className="app-sidebar-content">
          <nav className="app-nav">
            <div className="app-nav-section">
              <span className="app-nav-title">菜单</span>
              {menuItems.map((item) => (
                <Link
                  key={item.to}
                  href={item.to}
                  className={`app-nav-item ${pathname === item.to ? 'app-nav-item-active' : ''}`}
                >
                  <span className="app-nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </nav>
        </div>
        <div className="app-sidebar-footer">
          <div className="app-credits-card">
            <div className="app-credits-label">剩余积分</div>
            <div className="app-credits-value">{credits}</div>
          </div>
          <div className="app-user-info">
            <div className="app-user-avatar">{user?.email?.charAt(0).toUpperCase()}</div>
            <div className="app-user-details">
              <div className="app-user-email">{user?.email}</div>
              <div className="app-user-role">免费用户</div>
            </div>
          </div>
          <button
            className="app-logout-btn"
            onClick={() => {
              clearSession()
              router.push('/login')
            }}
          >
            退出登录
          </button>
        </div>
      </aside>
      <main className="app-main">{children}</main>
    </div>
  )
}
