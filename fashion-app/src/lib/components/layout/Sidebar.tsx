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
  PersonStanding,
  Sun,
  Moon,
} from 'lucide-react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useHydrated } from '@/lib/hooks/useHydrated'
import { useSidebarStore } from '@/lib/stores/sidebarStore'
import { useThemeStore } from '@/lib/stores/themeStore'
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
  'pose-presets': PersonStanding,
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
          'text-xs font-semibold uppercase tracking-[0.2em] px-3 py-2',
          collapsed && 'sr-only'
        )}
        style={{ color: 'var(--text-extreme)' }}
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
            prefetch={true}
            onClick={closeMobile}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-bold transition-all duration-200',
              collapsed && 'justify-center px-0'
            )}
            style={isActive ? {
              color: 'var(--icon-hover)',
              background: 'var(--bg-active)',
            } : {
              color: 'var(--text-primary)',
            }}
            title={collapsed ? item.label : undefined}
          >
            <Icon className={cn('shrink-0', collapsed ? 'w-5 h-5' : 'w-[18px] h-[18px]', isActive ? 'text-[var(--icon-hover)]' : 'text-[var(--icon-default)]')} />
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
          <div className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80 mb-1 relative">
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
        'flex items-center gap-3 p-3 rounded-2xl',
        collapsed && 'justify-center p-2'
      )}
      style={{
        background: 'var(--bg-muted)',
        border: '1px solid var(--border-light)',
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
          <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{user.email}</div>
          <div className="text-xs" style={{ color: 'var(--text-quaternary)' }}>
            {user.role === 'ADMIN' ? '管理员' : '客户'}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
        style={{
          background: 'var(--bg-sidebar)',
          paddingTop: 'env(safe-area-inset-top)',
          height: 'calc(56px + env(safe-area-inset-top))',
          boxShadow: '0 -8px 0 var(--bg-sidebar)',
        }}
      >
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Amou"
            className="w-9 h-9 rounded-2xl object-cover flex-shrink-0"
            style={{ boxShadow: '0 1px 6px rgba(139,115,85,0.12)' }}
          />
          <div className="leading-none">
            <span
              className="block text-lg font-bold"
              style={{ fontFamily: 'var(--font-parisienne)', color: 'var(--text-primary)' }}
            >
              Amou
            </span>
            <span className="block mt-0.5 text-xs font-medium tracking-[0.18em]" style={{ color: 'var(--text-tertiary)' }}>服装工作室</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {variant === 'app' && <NotificationBell />}
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-2xl hover:bg-[var(--bg-active)] dark:hover:bg-[rgba(255,255,255,0.06)] transition-colors"
          >
            <Menu className="w-5 h-5" style={{ color: 'var(--icon-default)' }} />
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
          'flex flex-col transition-[width] duration-150 ease-in-out',
          collapsed ? 'w-[68px]' : 'w-[240px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
        style={{
          background: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-light)',
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-5"
          style={{ paddingTop: 'calc(20px + env(titlebar-area-height, 0px))', borderBottom: '1px solid var(--border-light)' }}
        >
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Amou"
              className="w-10 h-10 rounded-2xl object-cover shrink-0"
              style={{ boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)' }}
            />
            {!collapsed && (
              <div className="min-w-0 leading-none">
                <span
                  className="text-xl font-bold block"
                  style={{ fontFamily: 'var(--font-parisienne)', color: 'var(--text-primary)' }}
                >
                  Amou
                </span>
                <span className="block mt-1 text-xs font-medium tracking-[0.18em]" style={{ color: 'var(--text-tertiary)' }}>服装工作室</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {variant === 'app' && <NotificationBell />}
            <button
              onClick={closeMobile}
              className="md:hidden p-1 rounded-2xl hover:bg-[var(--bg-active)] dark:hover:bg-[rgba(255,255,255,0.06)] transition-colors"
            >
              <X className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
            </button>
          </div>
        </div>

        {/* Desktop collapse toggle — positioned at right edge */}
        <button
          onClick={toggleCollapsed}
          className="hidden md:flex items-center justify-center w-6 h-6 rounded-full transition-colors absolute top-[22px] z-[101]"
          style={{
            color: 'var(--icon-default)',
            background: 'var(--bg-sidebar)',
            border: '1px solid var(--border-normal)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            right: '-12px',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--icon-hover)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--icon-default)' }}
          title={collapsed ? '展开' : '收起'}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Navigation */}
        <div className={cn('flex-1 p-4 overflow-y-auto', collapsed && 'p-2')}>{navContent}</div>

        {/* Footer */}
        <div className={cn('p-4', collapsed && 'p-2')} style={{ borderTop: '1px solid var(--border-light)' }}>
          <div className={cn('flex flex-col gap-3', collapsed && 'items-center')}>
            {creditsCard}
            <ThemeToggle collapsed={collapsed} />
            {userInfo}
            <button
              onClick={onLogout}
              className={cn(
                'flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200',
                collapsed && 'px-2'
              )}
              style={{
                color: 'var(--text-tertiary)',
                background: 'var(--bg-muted)',
                border: '1px solid var(--border-light)',
              }}
              title={collapsed ? '退出登录' : undefined}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(196,112,112,0.06)';
                e.currentTarget.style.borderColor = 'rgba(196,112,112,0.12)';
                e.currentTarget.style.color = '#c47070';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-muted)';
                e.currentTarget.style.borderColor = 'var(--border-light)';
                e.currentTarget.style.color = 'var(--text-tertiary)';
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

function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const isDark = theme === 'dark'

  if (collapsed) {
    return (
      <button
        onClick={toggleTheme}
        className="w-10 h-10 flex items-center justify-center rounded-2xl transition-all duration-300 hover:scale-105"
        style={{
          background: 'var(--bg-muted)',
          border: '1px solid var(--border-light)',
          color: 'var(--icon-default)',
        }}
        title={isDark ? '切换浅色' : '切换深色'}
      >
        {isDark ? <Sun className="w-4 h-4" style={{ color: 'var(--icon-hover)' }} /> : <Moon className="w-4 h-4" />}
      </button>
    )
  }

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-3 w-full px-4 py-2.5 rounded-2xl text-sm font-medium transition-all duration-300 hover:scale-[1.01]"
      style={{
        color: isDark ? 'var(--icon-hover)' : 'var(--icon-default)',
        background: 'var(--bg-muted)',
        border: '1px solid var(--border-light)',
      }}
    >
      <span className="relative w-5 h-5 flex items-center justify-center">
        <Sun
          className={cn(
            'w-[18px] h-[18px] absolute transition-all duration-500',
            isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
          )}
        />
        <Moon
          className={cn(
            'w-[18px] h-[18px] absolute transition-all duration-500',
            isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
          )}
        />
      </span>
      <span className="relative z-10">{isDark ? '浅色模式' : '深色模式'}</span>
    </button>
  )
}

export function SidebarMain({ children, maxWidth }: { children: React.ReactNode; maxWidth?: string }) {
  const collapsed = useSidebarStore((s) => s.collapsed)

  return (
    <main
      className={cn(
        'min-h-screen transition-[margin] duration-150 p-4 md:p-6 pb-24 md:pb-6 sidebar-main-pt',
        collapsed ? 'md:ml-[68px]' : 'md:ml-[240px]',
      )}
      style={{
        maxWidth: maxWidth || '1280px',
      }}
    >
      {children}
    </main>
  )
}

/** 所有应用端页面路径 —— 进入应用后后台预取，切换时瞬间完成 */
const ALL_APP_PATHS = [
  '/quick-workspace',
  '/redesign',
  '/favorites',
  '/history',
  '/tools',
  '/profile',
  '/recolor',
  '/model-fusion',
  '/production-sheet',
]

/** 管理端页面路径 */
const ALL_ADMIN_PATHS = [
  '/dashboard',
  '/customers',
  '/credits',
  '/records',
  '/notifications',
  '/templates',
  '/pose-presets',
  '/settings',
]

/** 移动端底部 Tab 对应的页面路径 */
const MOBILE_TAB_PATHS = [
  '/quick-workspace',
  '/redesign',
  '/favorites',
  '/history',
  '/tools',
]

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

  // 预取所有应用端页面 —— 进入应用后后台加载，切换时瞬间完成
  // PWA standalone 模式下同样生效，确保从主屏幕启动后页面切换零等待
  useEffect(() => {
    if (!hydrated || !user) return

    const timers: ReturnType<typeof setTimeout>[] = []
    ALL_APP_PATHS.forEach((path, index) => {
      const timer = setTimeout(() => {
        router.prefetch(path)
      }, 300 + index * 150)
      timers.push(timer)
    })

    return () => timers.forEach(clearTimeout)
  }, [hydrated, user, router])

  if (!hydrated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-5 h-5 border-2 rounded-full animate-spin"
            style={{ borderColor: 'rgba(198,123,92,0.2)', borderTopColor: '#c67b5c' }}
          />
          <span style={{ color: 'var(--text-tertiary)' }} className="text-sm">加载中...</span>
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
      {/* Chrome 桌面 PWA 标题栏拖拽区域 */}
      <div className="pwa-titlebar-drag hidden md:block" />
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
          background: 'var(--bg-sidebar)',
          borderTop: '1px solid var(--border-light)',
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
              prefetch={true}
              className="flex flex-col items-center gap-0.5 py-1.5 px-2 transition-colors"
              style={{ color: isActive ? 'var(--icon-hover)' : 'var(--text-quaternary)' }}
            >
              <Icon className={cn('w-[16px] h-[16px]', isActive && 'text-primary')} />
              <span className={cn('text-xs font-medium', isActive && 'font-semibold text-primary')}>{item.label}</span>
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

  // 预取所有管理端页面
  useEffect(() => {
    if (!hydrated || !user || user.role !== 'ADMIN') return

    const timers: ReturnType<typeof setTimeout>[] = []
    ALL_ADMIN_PATHS.forEach((path, index) => {
      const timer = setTimeout(() => {
        router.prefetch(path)
      }, 300 + index * 150)
      timers.push(timer)
    })

    return () => timers.forEach(clearTimeout)
  }, [hydrated, user, router])

  if (!hydrated || !user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-5 h-5 border-2 rounded-full animate-spin"
            style={{ borderColor: 'rgba(198,123,92,0.2)', borderTopColor: '#c67b5c' }}
          />
          <span style={{ color: 'var(--text-tertiary)' }} className="text-sm">加载中...</span>
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
    { to: '/pose-presets', label: '姿势管理', icon: 'pose-presets' },
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
