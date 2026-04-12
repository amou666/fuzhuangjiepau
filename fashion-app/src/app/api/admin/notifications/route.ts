import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, isAuthed } from '@/lib/api-auth'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const body = await request.json() as {
      title: string; content?: string; type?: string; targetUserIds?: string[];
    }
    const { title, content, type, targetUserIds: rawIds } = body

    if (!title?.trim()) {
      return NextResponse.json({ message: '标题不能为空' }, { status: 400 })
    }

    const notifType = type || 'announcement'
    const notifContent = content || ''

    const uniqueIds = rawIds?.length
      ? [...new Set(rawIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
      : null

    if (uniqueIds && uniqueIds.length > 500) {
      return NextResponse.json({ message: '单次最多向 500 人发送通知' }, { status: 400 })
    }

    const ids: string[] = []

    const insertAll = db.transaction(() => {
      if (uniqueIds && uniqueIds.length > 0) {
        for (const uid of uniqueIds) {
          const id = uuidv4()
          db.prepare(
            'INSERT INTO Notification (id, userId, type, title, content) VALUES (?, ?, ?, ?, ?)'
          ).run(id, uid, notifType, title.trim(), notifContent)
          ids.push(id)
        }
      } else {
        const id = uuidv4()
        db.prepare(
          'INSERT INTO Notification (id, userId, type, title, content) VALUES (?, NULL, ?, ?, ?)'
        ).run(id, notifType, title.trim(), notifContent)
        ids.push(id)
      }

      db.prepare(
        'INSERT INTO AdminAuditLog (id, adminId, action, detail) VALUES (?, ?, ?, ?)'
      ).run(uuidv4(), payload.userId, 'send_notification', `发送通知: ${title.trim()}${uniqueIds ? ` (${uniqueIds.length}人)` : ' (全体)'}`)
    })

    insertAll()

    return NextResponse.json({ ids, count: ids.length })
  } catch (error) {
    console.error('[Admin Notifications Error]', error)
    return NextResponse.json({ message: '发送通知失败' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth

    const notifications = db.prepare(
      `SELECT n.*, u.email as targetEmail FROM Notification n LEFT JOIN User u ON n.userId = u.id ORDER BY n.createdAt DESC LIMIT 100`
    ).all()

    return NextResponse.json({ notifications })
  } catch (error) {
    console.error('[Admin Notifications GET Error]', error)
    return NextResponse.json({ message: '获取通知列表失败' }, { status: 500 })
  }
}
