import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { queries } from '@/lib/db-queries'

interface DailyStatRow {
  date: string
  spent: number
  recharged: number
}

interface TypeStatRow {
  reason: string
  total: number
}

const dailyStmt = db.prepare<[string], DailyStatRow>(`
  SELECT DATE(createdAt) as date,
         COALESCE(SUM(CASE WHEN delta < 0 THEN ABS(delta) ELSE 0 END), 0) as spent,
         COALESCE(SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END), 0) as recharged
  FROM CreditLog
  WHERE userId = ?
  GROUP BY DATE(createdAt)
  HAVING spent > 0 OR recharged > 0
  ORDER BY date DESC
  LIMIT 30
`)

const typeStmt = db.prepare<[string], TypeStatRow>(`
  SELECT reason, COALESCE(SUM(ABS(delta)), 0) as total
  FROM CreditLog
  WHERE userId = ? AND delta < 0
  GROUP BY reason
`)

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const totalSpent = queries.creditLog.sumSpentByUserId(payload.userId)
    const totalRecharged = queries.creditLog.sumRechargedByUserId(payload.userId)

    const dailyStats = dailyStmt.all(payload.userId)

    const typeStats = typeStmt.all(payload.userId)
    const typeStatsObj: Record<string, number> = {}
    for (const row of typeStats) {
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
