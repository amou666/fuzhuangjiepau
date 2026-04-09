import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken } from '@/lib/auth'
import { safeJsonParse } from '@/lib/utils/json'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params
    const task = db.prepare('SELECT * FROM GenerationTask WHERE id = ?').get(id) as any

    if (!task) {
      return NextResponse.json({ message: '任务不存在' }, { status: 404 })
    }

    if (task.userId !== payload.userId && payload.role !== 'ADMIN') {
      return NextResponse.json({ message: '无权操作此任务' }, { status: 403 })
    }

    if (!task.resultUrl) {
      return NextResponse.json({ message: '任务尚未生成结果，无法放大' }, { status: 400 })
    }

    const { factor = 2 } = await request.json()
    const upscaleCost = 1

    // 检查积分
    const user = db.prepare('SELECT credits, apiKey FROM User WHERE id = ?').get(payload.userId) as any
    if (!user || user.credits < upscaleCost) {
      return NextResponse.json({ message: '积分不足，请联系管理员充值' }, { status: 403 })
    }

    // 检查 AI API Key
    if (!user.apiKey) {
      return NextResponse.json({ message: '未配置 AI API Key，请联系管理员' }, { status: 403 })
    }

    // 扣积分
    const newCredits = user.credits - upscaleCost
    db.prepare(`UPDATE User SET credits = ?, updatedAt = datetime('now') WHERE id = ?`).run(newCredits, payload.userId)
    db.prepare(
      'INSERT INTO CreditLog (id, userId, delta, balanceAfter, reason) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), payload.userId, -upscaleCost, newCredits, `图片放大 ${factor}x`)

    // 更新任务状态
    db.prepare(`UPDATE GenerationTask SET upscaleFactor = ?, updatedAt = datetime('now') WHERE id = ?`)
      .run(factor, id)

    // 异步处理放大
    processUpscale(id, task.resultUrl, factor).catch(err => console.error('[Upscale Error]', err))

    // 返回更新后的任务
    const updatedTask = db.prepare('SELECT * FROM GenerationTask WHERE id = ?').get(id) as any
    return NextResponse.json({
      task: {
        ...updatedTask,
        clothingDetailUrls: safeJsonParse(updatedTask.clothingDetailUrls, []),
        modelConfig: safeJsonParse(updatedTask.modelConfig, {}),
        sceneConfig: safeJsonParse(updatedTask.sceneConfig, {}),
      },
    })
  } catch (error) {
    console.error('[Upscale POST Error]', error)
    return NextResponse.json({ message: '启动放大任务失败' }, { status: 500 })
  }
}

async function processUpscale(taskId: string, imageUrl: string, factor: number) {
  const { processUpscaleTask } = await import('@/lib/task-processor')
  await processUpscaleTask(taskId, imageUrl, factor)
}
