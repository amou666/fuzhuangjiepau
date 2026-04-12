import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20))
    const offset = (page - 1) * limit

    const total = (db.prepare('SELECT COUNT(*) as count FROM CreditLog WHERE userId = ?').get(payload.userId) as any).count
    const logs = db.prepare(
      'SELECT * FROM CreditLog WHERE userId = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?'
    ).all(payload.userId, limit, offset)

    return NextResponse.json({
      logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('[Credits History Error]', error)
    return NextResponse.json({ message: '获取积分记录失败' }, { status: 500 })
  }
}
