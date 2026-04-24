import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { CreditService } from '@/lib/credit-service'
import { v4 as uuidv4 } from 'uuid'
import { AIService } from '@/lib/ai-service'
import { decryptApiKey } from '@/lib/utils/security'
import type { ModelConfig } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const body = await request.json()
    const { modelConfig, referenceUrl, extraPrompt }: {
      modelConfig: ModelConfig
      referenceUrl?: string
      extraPrompt?: string
    } = body

    if (!modelConfig) {
      return NextResponse.json({ message: '缺少模特配置参数' }, { status: 400 })
    }

    const trimmedExtraPrompt = typeof extraPrompt === 'string' ? extraPrompt.trim().slice(0, 800) : ''

    const user = db.prepare('SELECT credits, apiKey FROM User WHERE id = ?').get(payload.userId) as any
    if (!user || user.credits < 1) {
      return NextResponse.json({ message: '积分不足，请联系管理员充值' }, { status: 403 })
    }
    if (!user.apiKey) {
      return NextResponse.json({ message: '未配置 AI API Key，请联系管理员' }, { status: 403 })
    }
    const apiKey = decryptApiKey(user.apiKey)
    if (!apiKey) {
      return NextResponse.json({ message: 'AI API Key 解密失败，请联系管理员重新设置' }, { status: 500 })
    }

    const deductResult = db.transaction(() => {
      const currentUser = db.prepare('SELECT credits FROM User WHERE id = ?').get(payload.userId) as any
      if (!currentUser || currentUser.credits < 1) return null
      const newCredits = currentUser.credits - 1
      db.prepare(`UPDATE User SET credits = ?, updatedAt = datetime('now') WHERE id = ?`).run(newCredits, payload.userId)
      db.prepare(
        'INSERT INTO CreditLog (id, userId, delta, balanceAfter, reason) VALUES (?, ?, ?, ?, ?)'
      ).run(uuidv4(), payload.userId, -1, newCredits, '参数生成模特')
      return newCredits
    })()

    if (deductResult === null) {
      return NextResponse.json({ message: '积分不足，请联系管理员充值' }, { status: 403 })
    }

    const taskId = uuidv4()
    const ai = new AIService()

    try {
      const resultUrls = await ai.generateModelPortrait(taskId, modelConfig, apiKey, {
        referenceUrl,
        extraPrompt: trimmedExtraPrompt || undefined,
      })

      db.prepare(
        `INSERT INTO GenerationTask (id, userId, status, type, creditCost, clothingUrl, modelConfig, sceneConfig, resultUrl, resultUrls, finishedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run(
        taskId, payload.userId, 'COMPLETED', 'model-generate', 1,
        '', JSON.stringify(modelConfig), '{}',
        resultUrls[0], JSON.stringify(resultUrls)
      )

      return NextResponse.json({
        resultUrls,
        taskId,
        credits: deductResult,
      })
    } catch (aiError) {
      try {
        CreditService.refundCreditsOnce(
          payload.userId,
          1,
          taskId,
          `参数生成模特失败退款 (${taskId.slice(0, 8)})`,
        )
      } catch (refundError) {
        console.error('[Model Generate Refund Error]', refundError)
      }
      throw aiError
    }
  } catch (error) {
    console.error('[Model Generate Error]', error)
    const message = error instanceof Error ? error.message : '参数生成模特失败'
    return NextResponse.json({ message }, { status: 500 })
  }
}
