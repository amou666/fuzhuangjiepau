import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { safeJsonParse } from '@/lib/utils/json'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const { id } = await params
    const task = db.prepare('SELECT * FROM GenerationTask WHERE id = ?').get(id) as any

    if (!task) {
      return NextResponse.json({ message: '任务不存在' }, { status: 404 })
    }

    if (task.userId !== payload.userId && payload.role !== 'ADMIN') {
      return NextResponse.json({ message: '无权访问此任务' }, { status: 403 })
    }

    return NextResponse.json({
      task: {
        ...task,
        clothingDetailUrls: safeJsonParse(task.clothingDetailUrls, []),
        modelConfig: safeJsonParse(task.modelConfig, {}),
        sceneConfig: safeJsonParse(task.sceneConfig, {}),
        resultUrls: safeJsonParse(task.resultUrls, []),
      },
    })
  } catch (error) {
    console.error('[Task GET Error]', error)
    return NextResponse.json({ message: '获取任务详情失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const { id } = await params
    const task = db.prepare('SELECT * FROM GenerationTask WHERE id = ?').get(id) as any

    if (!task) {
      return NextResponse.json({ message: '任务不存在' }, { status: 404 })
    }

    // 允许用户删除自己的任务，或管理员删除任何任务
    if (task.userId !== payload.userId && payload.role !== 'ADMIN') {
      return NextResponse.json({ message: '无权删除此任务' }, { status: 403 })
    }

    db.prepare('DELETE FROM GenerationTask WHERE id = ?').run(id)

    return NextResponse.json({ message: '已删除' })
  } catch (error) {
    console.error('[Task DELETE Error]', error)
    return NextResponse.json({ message: '删除任务失败' }, { status: 500 })
  }
}
