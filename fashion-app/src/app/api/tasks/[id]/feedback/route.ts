import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth
    const { id: taskId } = await params

    const task = db.prepare('SELECT id, userId FROM GenerationTask WHERE id = ?').get(taskId) as any
    if (!task || task.userId !== payload.userId) {
      return NextResponse.json({ message: '任务不存在' }, { status: 404 })
    }

    const body = await request.json()
    const rating = Math.min(Math.max(Math.round(body.rating || 0), 1), 5)
    const comment = typeof body.comment === 'string' ? body.comment.slice(0, 200) : ''

    const existing = db.prepare('SELECT id FROM TaskFeedback WHERE taskId = ? AND userId = ?').get(taskId, payload.userId) as any
    if (existing) {
      db.prepare("UPDATE TaskFeedback SET rating = ?, comment = ?, createdAt = datetime('now') WHERE id = ?").run(rating, comment, existing.id)
    } else {
      db.prepare(
        'INSERT INTO TaskFeedback (id, taskId, userId, rating, comment) VALUES (?, ?, ?, ?, ?)'
      ).run(uuidv4(), taskId, payload.userId, rating, comment)
    }

    return NextResponse.json({ success: true, rating, comment })
  } catch (error) {
    console.error('[Task Feedback Error]', error)
    return NextResponse.json({ message: '提交反馈失败' }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth
    const { id: taskId } = await params

    const feedback = db.prepare('SELECT rating, comment FROM TaskFeedback WHERE taskId = ? AND userId = ?').get(taskId, payload.userId) as any

    return NextResponse.json({ feedback: feedback || null })
  } catch (error) {
    console.error('[Task Feedback GET Error]', error)
    return NextResponse.json({ message: '获取反馈失败' }, { status: 500 })
  }
}
