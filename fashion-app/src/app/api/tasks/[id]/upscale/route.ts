import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { safeJsonParse } from '@/lib/utils/json'
import { CreditService } from '@/lib/credit-service'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    // 2. 获取任务
    const { id } = await params
    console.log(`[Upscale] start taskId=${id}`)
    const task = db.prepare('SELECT * FROM GenerationTask WHERE id = ?').get(id) as any

    if (!task) {
      return NextResponse.json({ message: '任务不存在' }, { status: 404 })
    }

    if (task.userId !== payload.userId && payload.role !== 'ADMIN') {
      return NextResponse.json({ message: '无权操作此任务' }, { status: 403 })
    }

    // 3. 解析请求体
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ message: '请求体解析失败' }, { status: 400 })
    }
    const factor = Number(body.factor) || 2
    if (![2, 4].includes(factor)) {
      return NextResponse.json({ message: '放大倍数只支持 2x 或 4x' }, { status: 400 })
    }
    const imageUrl = body.imageUrl

    // 优先使用传入的 imageUrl，否则用 task.resultUrl
    const upscaleSourceUrl = imageUrl || task.resultUrl
    if (!upscaleSourceUrl) {
      return NextResponse.json({ message: '任务尚未生成结果，无法放大' }, { status: 400 })
    }

    // 4. 检查积分和 API Key
    const user = db.prepare('SELECT credits, apiKey FROM User WHERE id = ?').get(payload.userId) as any
    if (!user || user.credits < 1) {
      return NextResponse.json({ message: '积分不足，请联系管理员充值' }, { status: 403 })
    }

    if (!user.apiKey) {
      return NextResponse.json({ message: '未配置 AI API Key，请联系管理员' }, { status: 403 })
    }

    // 5. 扣积分
    let deductResult: number | null
    try {
      deductResult = CreditService.deductCredits(payload.userId, 1, `图片放大 ${factor}x`)
    } catch (dbErr: any) {
      console.error('[Upscale] 扣积分失败:', dbErr)
      return NextResponse.json({ message: `扣积分失败: ${dbErr.message}` }, { status: 500 })
    }

    if (deductResult === null) {
      return NextResponse.json({ message: '积分不足，请联系管理员充值' }, { status: 403 })
    }

    // 6. 清空旧的放大结果
    try {
      db.prepare(`UPDATE GenerationTask SET upscaleFactor = ?, upscaledUrl = NULL, errorMsg = NULL, updatedAt = datetime('now') WHERE id = ?`)
        .run(factor, id)
    } catch (dbErr: any) {
      console.error('[Upscale] 更新任务失败:', dbErr)
      return NextResponse.json({ message: `更新任务失败: ${dbErr.message}` }, { status: 500 })
    }

    // 7. 异步处理放大
    processUpscale(id, upscaleSourceUrl, factor, payload.userId).catch(err => console.error('[Upscale] 异步放大失败:', err))

    // 8. 返回更新后的任务
    const updatedTask = db.prepare('SELECT * FROM GenerationTask WHERE id = ?').get(id) as any
    console.log(`[Upscale] 启动成功, taskId=${id}`)
    return NextResponse.json({
      task: {
        ...updatedTask,
        clothingDetailUrls: safeJsonParse(updatedTask.clothingDetailUrls, []),
        modelConfig: safeJsonParse(updatedTask.modelConfig, {}),
        sceneConfig: safeJsonParse(updatedTask.sceneConfig, {}),
        resultUrls: safeJsonParse(updatedTask.resultUrls, []),
      },
    })
  } catch (error: any) {
    console.error('[Upscale POST Error]', error)
    const detail = error?.message || '未知错误'
    return NextResponse.json({ message: `启动放大任务失败: ${detail}` }, { status: 500 })
  }
}

async function processUpscale(taskId: string, imageUrl: string, factor: number, userId: string) {
  const { processUpscaleTask } = await import('@/lib/task-processor')
  await processUpscaleTask(taskId, imageUrl, factor, userId)
}
