import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { v4 as uuidv4 } from 'uuid'
import { AIService } from '@/lib/ai-service'
import { decryptApiKey } from '@/lib/utils/security'

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const { imageUrl }: { imageUrl: string } = await request.json()
    if (!imageUrl) {
      return NextResponse.json({ message: '缺少图片 URL' }, { status: 400 })
    }

    // 检查积分和 API Key
    const user = db.prepare('SELECT credits, apiKey FROM User WHERE id = ?').get(payload.userId) as any
    if (!user || user.credits < 1) {
      return NextResponse.json({ message: '积分不足（需要 1 积分），请联系管理员充值' }, { status: 403 })
    }

    if (!user.apiKey) {
      return NextResponse.json({ message: '未配置 AI API Key，请联系管理员' }, { status: 403 })
    }
    const apiKey = decryptApiKey(user.apiKey)
    if (!apiKey) {
      return NextResponse.json({ message: 'AI API Key 解密失败，请联系管理员重新设置' }, { status: 500 })
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
      ).run(uuidv4(), payload.userId, -1, newCredits, '生产单分析')
      return newCredits
    })()

    if (deductResult === null) {
      return NextResponse.json({ message: '积分不足（需要 1 积分），请联系管理员充值' }, { status: 403 })
    }

    // 执行 AI 分析
    const ai = new AIService()
    try {
      const data = await ai.analyzeProductionSheet(imageUrl, apiKey)
      console.log('[Production Sheet] AI result:', JSON.stringify(data))
      return NextResponse.json({ ...data, credits: deductResult })
    } catch (aiError) {
      // AI 失败，退还积分
      try {
        const currentUser = db.prepare('SELECT credits FROM User WHERE id = ?').get(payload.userId) as any
        if (currentUser) {
          const refundCredits = currentUser.credits + 1
          db.prepare(`UPDATE User SET credits = ?, updatedAt = datetime('now') WHERE id = ?`).run(refundCredits, payload.userId)
          db.prepare(
            'INSERT INTO CreditLog (id, userId, delta, balanceAfter, reason) VALUES (?, ?, ?, ?, ?)'
          ).run(uuidv4(), payload.userId, 1, refundCredits, '生产单分析失败退款')
        }
      } catch (refundError) {
        console.error('[Production Sheet Refund Error]', refundError)
      }
      throw aiError
    }
  } catch (error) {
    console.error('[Production Sheet Error]', error)
    const message = error instanceof Error ? error.message : '生产单分析失败'
    return NextResponse.json({ message }, { status: 500 })
  }
}
