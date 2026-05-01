import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { queries } from '@/lib/db-queries'

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const notifications = queries.notification.findByUserId(payload.userId)
    const unreadCount = queries.notification.countUnreadByUserId(payload.userId)

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error('[Notifications GET Error]', error)
    return NextResponse.json({ message: '获取通知失败' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const { action, notificationId } = await request.json()

    if (action === 'read_all') {
      db.prepare(
        `UPDATE Notification SET isRead = 1 WHERE userId = ? AND isRead = 0`
      ).run(payload.userId)
    } else if (action === 'read' && notificationId) {
      db.prepare(`UPDATE Notification SET isRead = 1 WHERE id = ? AND userId = ?`).run(notificationId, payload.userId)
    } else {
      return NextResponse.json({ message: '无效的操作' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Notifications PATCH Error]', error)
    return NextResponse.json({ message: '操作失败' }, { status: 500 })
  }
}
