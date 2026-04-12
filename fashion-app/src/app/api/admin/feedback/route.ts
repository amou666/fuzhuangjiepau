import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, isAuthed } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth

    const summary = db.prepare(`
      SELECT
        COUNT(*) as totalFeedback,
        ROUND(AVG(rating), 2) as avgRating,
        SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) as positiveCount,
        SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END) as negativeCount
      FROM TaskFeedback
    `).get() as any

    const distribution = db.prepare(`
      SELECT rating, COUNT(*) as count
      FROM TaskFeedback
      GROUP BY rating
      ORDER BY rating DESC
    `).all()

    const recent = db.prepare(`
      SELECT f.*, u.email as userEmail, t.type as taskType
      FROM TaskFeedback f
      LEFT JOIN User u ON f.userId = u.id
      LEFT JOIN GenerationTask t ON f.taskId = t.id
      ORDER BY f.createdAt DESC
      LIMIT 50
    `).all()

    return NextResponse.json({
      summary: {
        total: summary.totalFeedback || 0,
        avgRating: summary.avgRating || 0,
        positiveCount: summary.positiveCount || 0,
        negativeCount: summary.negativeCount || 0,
      },
      distribution,
      recent,
    })
  } catch (error) {
    console.error('[Admin Feedback Error]', error)
    return NextResponse.json({ message: '获取反馈数据失败' }, { status: 500 })
  }
}
