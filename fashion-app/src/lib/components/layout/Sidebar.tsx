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
  BarChart3,
  Megaphone,
  LayoutTemplate,
  Zap,
  Palette,
} from 'lucide-react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useHydrated } from '@/lib/hooks/useHydrated'
import { useSidebarStore } from '@/lib/stores/sidebarStore'
import { NotificationBell } from './NotificationPanel'

const appMenuIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  workspace: Sparkles,
  'quick-workspace': Zap,
  'model-fusion': Drama,
  tools: Wand2,
  redesign: Wand2,
  recolor: Palette,
  favorites: Gem,
  stats: BarChart3,
  history: Camera,
  profile: Settings,
}

const adminMenuIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  customers: Users,
  credits: Gem,
  records: FileImage,
  notifications: Megaphone,
  templates: LayoutTemplate,
  settings: Settings,
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
        const isActive = pathname === item.to || (item.to !== '/' && pathname.startsWith(item.to + '/'))
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
        }}
      >
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Amou"
            className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
            style={{ boxShadow: '0 1px 6px rgba(139,115,85,0.12)' }}
          />
          <div className="leading-none">
            <span
              className="block text-[17px] font-bold text-[#2d2422]"
              style={{ fontFamily: 'var(--font-parisienne)' }}
            >
              Amou
            </span>
            <span className="block mt-0.5 text-[9px] font-medium text-[#9b8e82] tracking-[0.18em]">服装工作室</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {variant === 'app' && <NotificationBell />}
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg hover:bg-[rgba(139,115,85,0.06)] transition-colors"
          >
            <Menu className="w-5 h-5 text-[#8b7355]" />
          </button>
        </div>
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Amou"
              className="w-10 h-10 rounded-xl object-cover shrink-0"
              style={{ boxShadow: '0 2px 12px rgba(139,115,85,0.15)' }}
            />
            {!collapsed && (
              <div className="min-w-0 leading-none">
                <span
                  className="text-[20px] font-bold text-[#2d2422] block"
                  style={{ fontFamily: 'var(--font-parisienne)' }}
                >
                  Amou
                </span>
                <span className="block mt-1 text-[10px] font-medium text-[#9b8e82] tracking-[0.18em]">服装工作室</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {variant === 'app' && <NotificationBell />}
            <button
              onClick={closeMobile}
              className="md:hidden p-1 rounded-lg hover:bg-[rgba(139,115,85,0.06)] transition-colors"
            >
              <X className="w-5 h-5 text-[#9b8e82]" />
            </button>
          </div>
        </div>

        {/* Desktop collapse toggle — positioned at right edge */}
        <button
          onClick={toggleCollapsed}
          className="hidden md:flex items-center justify-center w-6 h-6 rounded-full transition-colors text-[#8b7355] hover:text-[#c67b5c] absolute top-[22px] z-[101]"
          style={{
            background: 'rgba(255,253,250,0.95)',
            border: '1px solid rgba(139,115,85,0.12)',
            boxShadow: '0 2px 8px rgba(139,115,85,0.08)',
            right: '-12px',
          }}
          title={collapsed ? '展开' : '收起'}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

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
        'min-h-screen transition-all duration-300 p-4 md:p-6 pt-[68px] md:pt-8 pb-24 md:pb-6',
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
    { to: '/quick-workspace', label: '工作台', icon: 'quick-workspace' },
    { to: '/redesign', label: 'AI 改款', icon: 'redesign' },
    { to: '/favorites', label: '收藏夹', icon: 'favorites' },
    { to: '/history', label: '历史记录', icon: 'history' },
    { to: '/tools', label: '工具', icon: 'tools' },
    { to: '/profile', label: '个人中心', icon: 'profile' },
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

      {/* Mobile bottom tab bar — only show 5 core items */}
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
        {menuItems.filter((item) =>
          ['/quick-workspace', '/redesign', '/favorites', '/history', '/tools'].includes(item.to)
        ).map((item) => {
          const Icon = appMenuIcons[item.icon] || Sparkles
          const isActive = pathname === item.to
          return (
            <Link
              key={item.to}
              href={item.to}
              className="flex flex-col items-center gap-0.5 py-1.5 px-2 transition-colors"
              style={{ color: isActive ? '#c67b5c' : '#b0a59a' }}
            >
              <Icon className={cn('w-[16px] h-[16px]', isActive && 'text-[#c67b5c]')} />
              <span className={cn('text-[9px] font-medium', isActive && 'font-semibold text-[#c67b5c]')}>{item.label}</span>
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
    { to: '/notifications', label: '通知管理', icon: 'notifications' },
    { to: '/templates', label: '模板管理', icon: 'templates' },
    { to: '/settings', label: '系统设置', icon: 'settings' },
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
