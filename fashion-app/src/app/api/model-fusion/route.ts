import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'
import { AIService } from '@/lib/ai-service'
import { getUploadPath } from '@/lib/config'
import path from 'path'
import fs from 'fs/promises'

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { modelUrls }: { modelUrls: string[] } = body

    if (!modelUrls || !Array.isArray(modelUrls) || modelUrls.length === 0) {
      return NextResponse.json({ message: '至少需要上传 1 张模特参考图' }, { status: 400 })
    }

    if (modelUrls.length > 3) {
      return NextResponse.json({ message: '最多支持 3 张模特参考图' }, { status: 400 })
    }

    // 检查积分
    const user = db.prepare('SELECT credits, apiKey FROM User WHERE id = ?').get(payload.userId) as any
    if (!user || user.credits < 1) {
      return NextResponse.json({ message: '积分不足，请联系管理员充值' }, { status: 403 })
    }

    if (!user.apiKey) {
      return NextResponse.json({ message: '未配置 AI API Key，请联系管理员' }, { status: 403 })
    }

    // 扣积分
    const newCredits = user.credits - 1
    db.prepare(`UPDATE User SET credits = ?, updatedAt = datetime('now') WHERE id = ?`).run(newCredits, payload.userId)

    // 记录积分日志
    db.prepare(
      'INSERT INTO CreditLog (id, userId, delta, balanceAfter, reason) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), payload.userId, -1, newCredits, '模特合成')

    // 执行 AI 合成
    const taskId = uuidv4()
    const ai = new AIService()
    const resultUrl = await ai.fuseModelFaces(taskId, modelUrls, user.apiKey)

    return NextResponse.json({
      resultUrl,
      credits: newCredits,
    })
  } catch (error) {
    console.error('[Model Fusion Error]', error)
    if (error instanceof Error) {
      console.error('[Model Fusion Error Stack]', error.stack)
    }
    const message = error instanceof Error ? error.message : '模特合成失败'
    return NextResponse.json({ message }, { status: 500 })
  }
}
