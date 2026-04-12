import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const notifications = db.prepare(
      `SELECT * FROM Notification WHERE userId = ? OR userId IS NULL ORDER BY createdAt DESC LIMIT 50`
    ).all(payload.userId)

    const unreadCount = (db.prepare(
      `SELECT COUNT(*) as count FROM Notification WHERE (userId = ? OR userId IS NULL) AND isRead = 0`
    ).get(payload.userId) as any).count

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
