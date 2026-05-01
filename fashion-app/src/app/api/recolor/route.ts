import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { v4 as uuidv4 } from 'uuid'
import { AIService } from '@/lib/ai-service'
import { CreditService } from '@/lib/credit-service'
import { queries } from '@/lib/db-queries'
import { decryptApiKey } from '@/lib/utils/security'

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const body = await request.json()
    const { imageUrl, colorMappings, partsWithColors, brightness, saturation }: {
      imageUrl: string
      colorMappings?: Array<{
        sourceHex: string; sourceName: string; sourceHue: number; sourceLightMin: number; sourceLightMax: number; sourceGradient: string[];
        targetName: string; targetHex: string;
      }>
      partsWithColors?: Array<{ partId: string; partName: string; color: { name: string; hex: string } }>
      brightness?: number
      saturation?: number
    } = body

    if (!imageUrl) {
      return NextResponse.json({ message: '缺少图片 URL' }, { status: 400 })
    }

    const hasColorMappings = colorMappings && colorMappings.length > 0
    const hasPartsColors = partsWithColors && partsWithColors.length > 0

    if (!hasColorMappings && !hasPartsColors) {
      return NextResponse.json({ message: '请至少选择一个颜色替换方案' }, { status: 400 })
    }

    const creditCost = 1

    const userInfo = queries.user.findCreditsAndApiKey(payload.userId)
    if (!userInfo || userInfo.credits < creditCost) {
      return NextResponse.json({ message: `积分不足（需要 ${creditCost} 积分）` }, { status: 403 })
    }
    if (!userInfo.apiKey) {
      return NextResponse.json({ message: '未配置 AI API Key' }, { status: 403 })
    }
    const apiKey = decryptApiKey(userInfo.apiKey)
    if (!apiKey) {
      return NextResponse.json({ message: 'AI API Key 解密失败' }, { status: 500 })
    }

    const deductResult = CreditService.deductCredits(payload.userId, creditCost, 'AI改色')
    if (deductResult === null) {
      return NextResponse.json({ message: `积分不足（需要 ${creditCost} 积分）` }, { status: 403 })
    }

    const taskId = uuidv4()
    const ai = new AIService()

    try {
      let resultUrl: string
      let label: string

      if (hasColorMappings) {
        // 颜色映射模式
        resultUrl = await ai.recolorByColorMapping(
          taskId, imageUrl, colorMappings!, apiKey,
          { brightness: brightness || 0, saturation: saturation || 0 },
        )
        label = colorMappings!.map(m => `${m.sourceName}→${m.targetName}`).join(' + ')
      } else {
        // 部件模式（兼容）
        resultUrl = await ai.recolorGarmentPerPart(
          taskId, imageUrl, partsWithColors!, apiKey,
          { brightness: brightness || 0, saturation: saturation || 0 },
        )
        label = partsWithColors!.map(pc => `${pc.partName}→${pc.color.name}`).join(' + ')
      }

      db.prepare(
        `INSERT INTO GenerationTask (id, userId, status, type, creditCost, clothingUrl, modelConfig, sceneConfig, resultUrl, resultUrls, clothingDescription, finishedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run(
        taskId, payload.userId, 'COMPLETED', 'recolor', creditCost,
        imageUrl, '{}', '{}',
        resultUrl, JSON.stringify([resultUrl]),
        `AI改色 | ${label}${brightness ? ` | 明度:${brightness > 0 ? '+' : ''}${brightness}%` : ''}${saturation ? ` | 饱和度:${saturation > 0 ? '+' : ''}${saturation}%` : ''}`
      )

      return NextResponse.json({ resultUrl, taskId, credits: deductResult })
    } catch (aiError) {
      try { CreditService.refundCreditsOnce(payload.userId, creditCost, taskId, `改色失败退款 (${taskId.slice(0, 8)})`) } catch {}
      throw aiError
    }
  } catch (error) {
    console.error('[Recolor Error]', error)
    const message = error instanceof Error ? error.message : '改色生成失败'
    return NextResponse.json({ message }, { status: 500 })
  }
}
