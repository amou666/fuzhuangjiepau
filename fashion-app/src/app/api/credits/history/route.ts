import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: '未授权' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const payload = verifyAccessToken(token)
    if (!payload) {
      return NextResponse.json({ message: '令牌无效' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
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
