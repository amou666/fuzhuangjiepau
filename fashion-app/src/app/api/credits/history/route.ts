import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { queries } from '@/lib/db-queries'

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20))
    const offset = (page - 1) * limit

    const total = queries.creditLog.countByUserId(payload.userId)
    const logs = queries.creditLog.findHistoryByUserId(payload.userId, limit, offset)

    return NextResponse.json({
      logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('[Credits History Error]', error)
    return NextResponse.json({ message: '获取积分记录失败' }, { status: 500 })
  }
}
