import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const totalSpent = Math.abs((db.prepare('SELECT COALESCE(SUM(ABS(delta)), 0) as total FROM CreditLog WHERE userId = ? AND delta < 0').get(payload.userId) as any).total)
    const totalRecharged = (db.prepare('SELECT COALESCE(SUM(delta), 0) as total FROM CreditLog WHERE userId = ? AND delta > 0').get(payload.userId) as any).total

    // 每日统计
    const dailyStats = db.prepare(`
      SELECT DATE(createdAt) as date,
             COALESCE(SUM(CASE WHEN delta < 0 THEN ABS(delta) ELSE 0 END), 0) as spent,
             COALESCE(SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END), 0) as recharged
      FROM CreditLog
      WHERE userId = ?
      GROUP BY DATE(createdAt)
      ORDER BY date DESC
      LIMIT 30
    `).all(payload.userId)

    // 类型统计
    const typeStats = db.prepare(`
      SELECT reason, COALESCE(SUM(ABS(delta)), 0) as total
      FROM CreditLog
      WHERE userId = ? AND delta < 0
      GROUP BY reason
    `).all(payload.userId)

    const typeStatsObj: Record<string, number> = {}
    for (const row of typeStats as any[]) {
      typeStatsObj[row.reason] = row.total
    }

    return NextResponse.json({
      totalSpent,
      totalRecharged,
      dailyStats,
      typeStats: typeStatsObj,
    })
  } catch (error) {
    console.error('[Credits Summary Error]', error)
    return NextResponse.json({ message: '获取积分汇总失败' }, { status: 500 })
  }
}
