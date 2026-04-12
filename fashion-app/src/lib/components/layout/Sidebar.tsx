'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Sparkles,
  Drama,
  Camera,
  Settings,
  LayoutDashboard,
  Users,
  Gem,
  FileImage,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Coins,
  Wand2,
} from 'lucide-react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useHydrated } from '@/lib/hooks/useHydrated'
import { useSidebarStore } from '@/lib/stores/sidebarStore'

const appMenuIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  workspace: Sparkles,
  'model-fusion': Drama,
  redesign: Wand2,
  history: Camera,
  profile: Settings,
}

const adminMenuIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  customers: Users,
  credits: Gem,
  records: FileImage,
  'audit-logs': ShieldCheck,
}

interface SidebarProps {
  variant: 'app' | 'admin'
  menuItems: { to: string; label: string; icon: string }[]
  onLogout: () => void
}

export function Sidebar({ variant, menuItems, onLogout }: SidebarProps) {
  const collapsed = useSidebarStore((s) => s.collapsed)
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const user = useAuthStore((state) => state.user)
  const credits = useAuthStore((state) => state.user?.credits ?? 0)

  const iconMap = variant === 'app' ? appMenuIcons : adminMenuIcons

  const closeMobile = useCallback(() => setMobileOpen(false), [])

  useEffect(() => {
    closeMobile()
  }, [pathname, closeMobile])

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const navContent = (
    <nav className="flex flex-col gap-1">
      <span
        className={cn(
          'text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c9bfb5] px-3 py-2',
          collapsed && 'sr-only'
        )}
      >
        {variant === 'admin' ? '管理' : '导航'}
      </span>
      {menuItems.map((item) => {
        const Icon = iconMap[item.to.replace('/', '')] || Sparkles
        const isActive = pathname === item.to
        return (
          <Link
            key={item.to}
            href={item.to}
            onClick={closeMobile}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-bold transition-all duration-200',
              isActive
                ? 'text-[#c67b5c]'
                : 'text-[#5a4a3a] hover:text-[#8b5a3c]',
              collapsed && 'justify-center px-0'
            )}
            style={isActive ? {
              background: 'rgba(198,123,92,0.08)',
            } : undefined}
            title={collapsed ? item.label : undefined}
          >
            <Icon className={cn('shrink-0', isActive ? 'text-[#c67b5c]' : '', collapsed ? 'w-5 h-5' : 'w-[18px] h-[18px]')} />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        )
      })}
    </nav>
  )

  const creditsCard = variant === 'app' && (
    <div
      className={cn(
        'rounded-2xl p-5 relative overflow-hidden',
        collapsed && 'p-2'
      )}
      style={{
        background: 'linear-gradient(135deg, #c67b5c 0%, #d4a882 100%)',
        boxShadow: '0 4px 20px rgba(198,123,92,0.2)',
        color: '#fff',
      }}
    >
      {collapsed ? (
        <div className="flex flex-col items-center gap-1">
          <Coins className="w-5 h-5 relative" />
          <span className="text-xs font-bold relative">{credits}</span>
        </div>
      ) : (
        <>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-80 mb-1 relative">
            积分余额
          </div>
          <div className="text-2xl font-bold tracking-tight relative">{credits}</div>
        </>
      )}
    </div>
  )

  const userInfo = user && (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl',
        collapsed && 'justify-center p-2'
      )}
      style={{
        background: 'rgba(139,115,85,0.04)',
        border: '1px solid rgba(139,115,85,0.06)',
      }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0"
        style={{
          background: 'linear-gradient(135deg, #c67b5c, #d4a882)',
          boxShadow: '0 2px 8px rgba(198,123,92,0.2)',
        }}
      >
        {user.email?.charAt(0).toUpperCase()}
      </div>
      {!collapsed && (
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-[#2d2422] truncate">{user.email}</div>
          <div className="text-[11px] text-[#b0a59a]">
            {user.role === 'ADMIN' ? '管理员' : '免费用户'}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 z-50 flex items-center justify-between px-4"
        style={{
          background: 'rgba(250,247,244,0.9)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(139,115,85,0.06)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #c67b5c, #d4a882)' }}
          >
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-[#2d2422] tracking-tight">Amou AI</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg hover:bg-[rgba(139,115,85,0.06)] transition-colors"
        >
          <Menu className="w-5 h-5 text-[#8b7355]" />
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-[99]"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 bottom-0 z-[100]',
          'flex flex-col transition-all duration-300 ease-in-out',
          collapsed ? 'w-[68px]' : 'w-[240px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
        style={{
          background: 'rgba(255,253,250,0.92)',
          backdropFilter: 'blur(24px) saturate(1.2)',
          borderRight: '1px solid rgba(139,115,85,0.06)',
          boxShadow: '4px 0 24px rgba(139,115,85,0.04)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[rgba(139,115,85,0.06)]">
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, #c67b5c, #d4a882)',
                boxShadow: '0 2px 12px rgba(198,123,92,0.2)',
              }}
            >
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            {!collapsed && (
              <div>
                <span className="text-[15px] font-bold text-[#2d2422] tracking-tight block leading-tight">Amou AI</span>
                <span className="text-[9px] text-[#b0a59a] tracking-[0.2em] uppercase">工作台</span>
              </div>
            )}
          </div>
          <button
            onClick={toggleCollapsed}
            className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[rgba(139,115,85,0.06)] transition-colors text-[#b0a59a] hover:text-[#8b7355]"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={closeMobile}
            className="md:hidden p-1 rounded-lg hover:bg-[rgba(139,115,85,0.06)] transition-colors"
          >
            <X className="w-5 h-5 text-[#9b8e82]" />
          </button>
        </div>

        {/* Navigation */}
        <div className={cn('flex-1 p-4 overflow-y-auto', collapsed && 'p-2')}>{navContent}</div>

        {/* Footer */}
        <div className={cn('p-4 border-t border-[rgba(139,115,85,0.06)]', collapsed && 'p-2')}>
          <div className={cn('flex flex-col gap-3', collapsed && 'items-center')}>
            {creditsCard}
            {userInfo}
            <button
              onClick={onLogout}
              className={cn(
                'flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200',
                collapsed && 'px-2'
              )}
              style={{
                color: '#9b8e82',
                background: 'rgba(139,115,85,0.03)',
                border: '1px solid rgba(139,115,85,0.06)',
              }}
              title={collapsed ? '退出登录' : undefined}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(196,112,112,0.06)';
                e.currentTarget.style.borderColor = 'rgba(196,112,112,0.12)';
                e.currentTarget.style.color = '#c47070';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(139,115,85,0.03)';
                e.currentTarget.style.borderColor = 'rgba(139,115,85,0.06)';
                e.currentTarget.style.color = '#9b8e82';
              }}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!collapsed && <span>退出登录</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

export function SidebarMain({ children, maxWidth }: { children: React.ReactNode; maxWidth?: string }) {
  const collapsed = useSidebarStore((s) => s.collapsed)

  return (
    <main
      className={cn(
        'min-h-screen transition-all duration-300 p-6 pt-20 md:pt-8 pb-24 md:pb-6',
        collapsed ? 'md:ml-[68px]' : 'md:ml-[240px]',
      )}
      style={{ maxWidth: maxWidth || '1280px' }}
    >
      {children}
    </main>
  )
}

export function AppSidebarLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const user = useAuthStore((state) => state.user)
  const hydrated = useHydrated()
  const clearSession = useAuthStore((state) => state.clearSession)

  useEffect(() => {
    if (hydrated && !user) {
      router.push('/login')
    }
  }, [user, hydrated, router])

  if (!hydrated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#faf7f4' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-5 h-5 border-2 rounded-full animate-spin"
            style={{ borderColor: 'rgba(198,123,92,0.2)', borderTopColor: '#c67b5c' }}
          />
          <span className="text-[#9b8e82] text-sm">加载中...</span>
        </div>
      </div>
    )
  }

  const menuItems = [
    { to: '/workspace', label: '工作台', icon: 'workspace' },
    { to: '/model-fusion', label: '模特合成', icon: 'model-fusion' },
    { to: '/redesign', label: 'AI 改款', icon: 'redesign' },
    { to: '/history', label: '历史记录', icon: 'history' },
    { to: '/profile', label: '账户设置', icon: 'profile' },
  ]

  return (
    <div className="min-h-screen">
      <Sidebar
        variant="app"
        menuItems={menuItems}
        onLogout={() => {
          clearSession()
          router.push('/login')
        }}
      />
      <SidebarMain maxWidth="1200px">{children}</SidebarMain>

      {/* Mobile bottom tab bar */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around"
        style={{
          background: 'rgba(255,253,250,0.92)',
          backdropFilter: 'blur(20px) saturate(1.2)',
          borderTop: '1px solid rgba(139,115,85,0.08)',
          boxShadow: '0 -4px 20px rgba(139,115,85,0.06)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {menuItems.map((item) => {
          const Icon = appMenuIcons[item.icon] || Sparkles
          const isActive = pathname === item.to
          return (
            <Link
              key={item.to}
              href={item.to}
              className="flex flex-col items-center gap-0.5 py-2 px-3 transition-colors"
              style={{ color: isActive ? '#c67b5c' : '#b0a59a' }}
            >
              <Icon className={cn('w-[18px] h-[18px]', isActive && 'text-[#c67b5c]')} />
              <span className={cn('text-[10px] font-medium', isActive && 'font-semibold text-[#c67b5c]')}>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export function AdminSidebarLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#faf7f4' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-5 h-5 border-2 rounded-full animate-spin"
            style={{ borderColor: 'rgba(198,123,92,0.2)', borderTopColor: '#c67b5c' }}
          />
          <span className="text-[#9b8e82] text-sm">加载中...</span>
        </div>
      </div>
    )
  }

  const menuItems = [
    { to: '/dashboard', label: '数据看板', icon: 'dashboard' },
    { to: '/customers', label: '客户管理', icon: 'customers' },
    { to: '/credits', label: '积分管理', icon: 'credits' },
    { to: '/records', label: '生图记录', icon: 'records' },
    { to: '/audit-logs', label: '审计日志', icon: 'audit-logs' },
  ]

  return (
    <div className="min-h-screen">
      <Sidebar
        variant="admin"
        menuItems={menuItems}
        onLogout={() => {
          clearSession()
          router.push('/login')
        }}
      />
      <SidebarMain>{children}</SidebarMain>
    </div>
  )
}
