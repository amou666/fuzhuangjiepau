'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { workspaceApi } from '@/lib/api/workspace'
import { Bell, CheckCheck, Megaphone, Coins, Info, X } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/format'

interface Notification {
  id: string
  userId: string | null
  type: string
  title: string
  content: string
  isRead: number
  createdAt: string
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  announcement: Megaphone,
  credit: Coins,
  system: Info,
}

const TYPE_COLORS: Record<string, string> = {
  announcement: '#c67b5c',
  credit: '#7d9b76',
  system: '#8b7355',
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await workspaceApi.getNotifications()
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch {}
  }, [])

  useEffect(() => {
    fetchNotifications()
    // 轮询间隔 15 秒，比之前的 30 秒更及时
    const interval = setInterval(fetchNotifications, 15000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleMarkAllRead = async () => {
    try {
      await workspaceApi.markNotificationsRead('read_all')
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: 1 })))
      setUnreadCount(0)
    } catch {}
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl hover:bg-[rgba(139,115,85,0.06)] transition-colors"
        title="通知"
      >
        <Bell className="w-[18px] h-[18px] text-[#8b7355]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-[#c67b5c] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed md:absolute top-14 md:top-full right-2 md:right-auto left-2 md:left-full mt-0 md:mt-2 md:ml-2 md:w-[340px] max-h-[440px] bg-white/95 backdrop-blur-xl rounded-2xl border border-[rgba(139,115,85,0.1)] shadow-xl z-[200] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(139,115,85,0.06)]">
            <h3 className="text-[14px] font-bold text-[#2d2422]">通知中心</h3>
            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-[#8b7355] hover:bg-[rgba(139,115,85,0.06)] transition-colors"
                  onClick={handleMarkAllRead}
                >
                  <CheckCheck className="w-3 h-3" /> 全部已读
                </button>
              )}
              <button
                className="w-6 h-6 rounded-lg flex items-center justify-center text-[#b0a59a] hover:bg-[rgba(139,115,85,0.06)] transition-colors"
                onClick={() => setOpen(false)}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 text-[#c9bfb5] mx-auto mb-2" />
                <p className="text-[12px] text-[#c9bfb5]">暂无通知</p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type] || Info
                const color = TYPE_COLORS[n.type] || '#8b7355'
                return (
                  <div
                    key={n.id}
                    className="px-4 py-3 border-b border-[rgba(139,115,85,0.04)] hover:bg-[rgba(139,115,85,0.02)] transition-colors"
                    style={{ opacity: n.isRead ? 0.6 : 1 }}
                  >
                    <div className="flex gap-2.5">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: `${color}12` }}
                      >
                        <Icon className="w-3.5 h-3.5" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-semibold text-[#2d2422] truncate">{n.title}</span>
                          {!n.isRead && (
                            <span className="w-1.5 h-1.5 bg-[#c67b5c] rounded-full flex-shrink-0" />
                          )}
                        </div>
                        {n.content && (
                          <p className="text-[11px] text-[#9b8e82] mt-0.5 leading-relaxed line-clamp-2">{n.content}</p>
                        )}
                        <span className="text-[10px] text-[#c9bfb5] mt-1 block">{formatDateTime(n.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
