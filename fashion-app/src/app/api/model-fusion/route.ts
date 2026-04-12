import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { CreditService } from '@/lib/credit-service'
import { v4 as uuidv4 } from 'uuid'
import { AIService } from '@/lib/ai-service'

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const body = await request.json()
    const { modelUrls, weights, strategy }: {
      modelUrls: string[]
      weights?: number[]
      strategy?: 'balanced' | 'feature-pick' | 'dominant'
    } = body

    if (!modelUrls || !Array.isArray(modelUrls) || modelUrls.length === 0) {
      return NextResponse.json({ message: '至少需要上传 1 张模特参考图' }, { status: 400 })
    }

    if (modelUrls.length > 3) {
      return NextResponse.json({ message: '最多支持 3 张模特参考图' }, { status: 400 })
    }

    // 检查积分和 API Key
    const user = db.prepare('SELECT credits, apiKey FROM User WHERE id = ?').get(payload.userId) as any
    if (!user || user.credits < 1) {
      return NextResponse.json({ message: '积分不足，请联系管理员充值' }, { status: 403 })
    }

    if (!user.apiKey) {
      return NextResponse.json({ message: '未配置 AI API Key，请联系管理员' }, { status: 403 })
    }

    // 事务保护：扣积分 + 记录日志
    const deductResult = db.transaction(() => {
      const currentUser = db.prepare('SELECT credits FROM User WHERE id = ?').get(payload.userId) as any
      if (!currentUser || currentUser.credits < 1) {
        return null
      }
      const newCredits = currentUser.credits - 1
      db.prepare(`UPDATE User SET credits = ?, updatedAt = datetime('now') WHERE id = ?`).run(newCredits, payload.userId)
      db.prepare(
        'INSERT INTO CreditLog (id, userId, delta, balanceAfter, reason) VALUES (?, ?, ?, ?, ?)'
      ).run(uuidv4(), payload.userId, -1, newCredits, '模特合成')
      return newCredits
    })()

    if (deductResult === null) {
      return NextResponse.json({ message: '积分不足，请联系管理员充值' }, { status: 403 })
    }

    // 执行 AI 合成
    const taskId = uuidv4()
    const ai = new AIService()

    try {
      const resultUrl = await ai.fuseModelFaces(taskId, modelUrls, user.apiKey, { weights, strategy })

      // 保存记录到 GenerationTask
      db.prepare(
        `INSERT INTO GenerationTask (id, userId, status, type, creditCost, clothingUrl, modelConfig, sceneConfig, resultUrl, resultUrls, finishedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run(
        taskId, payload.userId, 'COMPLETED', 'model-fusion', 1,
        '', JSON.stringify({ modelUrls }), '{}',
        resultUrl, JSON.stringify([resultUrl])
      )

      return NextResponse.json({
        resultUrl,
        taskId,
        credits: deductResult,
      })
    } catch (aiError) {
      // AI 合成失败，退还积分
      try {
        CreditService.addCredits(payload.userId, 1, `模特合成失败退款 (${taskId.slice(0, 8)})`)
      } catch (refundError) {
        console.error('[Model Fusion Refund Error]', refundError)
      }
      throw aiError
    }
  } catch (error) {
    console.error('[Model Fusion Error]', error)
    const message = error instanceof Error ? error.message : '模特合成失败'
    return NextResponse.json({ message }, { status: 500 })
  }
}
