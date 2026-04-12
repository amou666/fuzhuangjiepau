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
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ message: '仅管理员可访问' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const whereClause = "WHERE cl.reason NOT LIKE 'task:%'"

    const total = (db.prepare(`SELECT COUNT(*) as count FROM CreditLog cl ${whereClause}`).get() as any).count
    const logs = db.prepare(`
      SELECT cl.*, u.email as userEmail
      FROM CreditLog cl
      LEFT JOIN User u ON cl.userId = u.id
      ${whereClause}
      ORDER BY cl.createdAt DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset)

    return NextResponse.json({
      logs: logs.map((l: any) => ({
        ...l,
        user: l.userEmail ? { email: l.userEmail } : undefined,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('[Admin Credits Logs Error]', error)
    return NextResponse.json({ message: '获取积分日志失败' }, { status: 500 })
  }
}
