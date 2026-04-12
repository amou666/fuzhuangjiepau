import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { safeJsonParse } from '@/lib/utils/json'

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const userId = payload.userId

    // 概览
    const totalTasks = (db.prepare('SELECT COUNT(*) as count FROM GenerationTask WHERE userId = ?').get(userId) as any).count
    const successTasks = (db.prepare("SELECT COUNT(*) as count FROM GenerationTask WHERE userId = ? AND status = 'COMPLETED'").get(userId) as any).count
    const failedTasks = (db.prepare("SELECT COUNT(*) as count FROM GenerationTask WHERE userId = ? AND status = 'FAILED'").get(userId) as any).count
    const pendingTasks = totalTasks - successTasks - failedTasks
    const successRate = totalTasks > 0 ? ((successTasks / totalTasks) * 100).toFixed(1) : '0.0'

    // 模特偏好
    const tasks = db.prepare('SELECT modelConfig FROM GenerationTask WHERE userId = ?').all(userId) as any[]

    const gender: Record<string, number> = {}
    const bodyType: Record<string, number> = {}
    const pose: Record<string, number> = {}
    const preset: Record<string, number> = {}

    for (const task of tasks) {
      try {
        const mc = safeJsonParse<Record<string, string>>(task.modelConfig, {})
        if (mc.gender) gender[mc.gender] = (gender[mc.gender] || 0) + 1
        if (mc.bodyType) bodyType[mc.bodyType] = (bodyType[mc.bodyType] || 0) + 1
        if (mc.pose) pose[mc.pose] = (pose[mc.pose] || 0) + 1
      } catch {}
    }

    const sceneTasks = db.prepare('SELECT sceneConfig FROM GenerationTask WHERE userId = ?').all(userId) as any[]
    for (const task of sceneTasks) {
      try {
        const sc = safeJsonParse<Record<string, string>>(task.sceneConfig, {})
        if (sc.preset) preset[sc.preset] = (preset[sc.preset] || 0) + 1
      } catch {}
    }

    // 每日统计
    const dailyStats = db.prepare(`
      SELECT DATE(createdAt) as date,
             COUNT(*) as total,
             SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as success,
             SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
      FROM GenerationTask
      WHERE userId = ?
      GROUP BY DATE(createdAt)
      ORDER BY date DESC
      LIMIT 30
    `).all(userId)

    return NextResponse.json({
      overview: {
        totalTasks,
        successTasks,
        failedTasks,
        pendingTasks,
        successRate,
        avgProcessingTime: 0,
      },
      modelPreferences: { gender, bodyType, pose },
      scenePreferences: { preset },
      dailyStats,
    })
  } catch (error) {
    console.error('[Stats Generation Error]', error)
    return NextResponse.json({ message: '获取统计失败' }, { status: 500 })
  }
}
