'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { useHydrated } from '@/lib/hooks/useHydrated'

const menuItems = [
  { to: '/dashboard', label: '数据看板', icon: '📊' },
  { to: '/customers', label: '客户管理', icon: '👥' },
  { to: '/credits', label: '积分管理', icon: '💎' },
  { to: '/records', label: '生图记录', icon: '📸' },
  { to: '/audit-logs', label: '审计日志', icon: '🛡️' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const user = useAuthStore((state) => state.user)
  const hydrated = useHydrated()
  const clearSession = useAuthStore((state) => state.clearSession)

  useEffect(() => {
    if (hydrated && (!user || user.role !== 'ADMIN')) {
      router.push('/login')
    }
  }, [user, hydrated, router])

  if (!hydrated || !user || user.role !== 'ADMIN') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', color: '#fff' }}>
        <div>加载中...</div>
      </div>
    )
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">✨</span>
            <span className="logo-text">Fashion AI</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">导航菜单</div>
            {menuItems.map((item) => (
              <Link
                key={item.to}
                href={item.to}
                className={`nav-item ${pathname === item.to ? 'nav-item-active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              <span>{user?.email?.charAt(0).toUpperCase()}</span>
            </div>
            <div className="user-details">
              <div className="user-email">{user?.email}</div>
              <div className="user-role">管理员</div>
            </div>
          </div>
          <button
            className="logout-button"
            onClick={() => {
              clearSession()
              router.push('/login')
            }}
          >
            退出登录
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <div className="main-shell">{children}</div>
      </main>
    </div>
  )
}
