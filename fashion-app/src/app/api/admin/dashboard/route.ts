import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, isAuthed } from '@/lib/api-auth'
import { safeJsonParse } from '@/lib/utils/json'

export async function GET(request: NextRequest) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    // 统计概览
    const customerCount = (db.prepare('SELECT COUNT(*) as count FROM User WHERE role = ?').get('CUSTOMER') as any).count
    const taskCount = (db.prepare('SELECT COUNT(*) as count FROM GenerationTask').get() as any).count
    const totalCreditsConsumed = (db.prepare('SELECT COALESCE(SUM(ABS(delta)), 0) as total FROM CreditLog WHERE delta < 0').get() as any).total
    const activeCustomerCount = (db.prepare('SELECT COUNT(*) as count FROM User WHERE role = ? AND isActive = 1').get('CUSTOMER') as any).count

    // 近7天生图趋势
    const dailyTasks = db.prepare(`
      SELECT DATE(createdAt) as date, COUNT(*) as count
      FROM GenerationTask
      WHERE createdAt >= datetime('now', '-7 days')
      GROUP BY DATE(createdAt)
      ORDER BY date DESC
    `).all()

    // 客户积分消耗排行
    const topCustomers = db.prepare(`
      SELECT u.email, COALESCE(SUM(ABS(cl.delta)), 0) as spent
      FROM User u
      LEFT JOIN CreditLog cl ON cl.userId = u.id AND cl.delta < 0
      WHERE u.role = 'CUSTOMER'
      GROUP BY u.id
      ORDER BY spent DESC
      LIMIT 10
    `).all()

    // 最近任务
    const recentTasks = db.prepare(`
      SELECT t.*, u.email as userEmail
      FROM GenerationTask t
      LEFT JOIN User u ON t.userId = u.id
      ORDER BY t.createdAt DESC
      LIMIT 10
    `).all()

    return NextResponse.json({
      summary: { customerCount, taskCount, totalCreditsConsumed: Math.abs(totalCreditsConsumed), activeCustomerCount },
      dailyTasks,
      topCustomers,
      recentTasks: recentTasks.map((t: any) => ({
        ...t,
        clothingDetailUrls: safeJsonParse(t.clothingDetailUrls, []),
        modelConfig: safeJsonParse(t.modelConfig, {}),
        sceneConfig: safeJsonParse(t.sceneConfig, {}),
        user: t.userEmail ? { email: t.userEmail } : undefined,
      })),
    })
  } catch (error) {
    console.error('[Admin Dashboard Error]', error)
    return NextResponse.json({ message: '获取看板数据失败' }, { status: 500 })
  }
}
