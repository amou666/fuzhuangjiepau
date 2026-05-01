import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { CreditService } from '@/lib/credit-service'
import { queries } from '@/lib/db-queries'
import { v4 as uuidv4 } from 'uuid'
import { AIService } from '@/lib/ai-service'
import { decryptApiKey } from '@/lib/utils/security'

type RedesignMode = 'luxury-color' | 'material-element' | 'material-silhouette' | 'commercial-brainstorm'

const MODE_LABELS: Record<RedesignMode, string> = {
  'luxury-color': '奢侈品色系变色',
  'material-element': '材质感知加元素',
  'material-silhouette': '材质锁定改款式',
  'commercial-brainstorm': '商业脑暴模式',
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const body = await request.json()
    const { imageUrl, mode, customPrompt, excludedItems, constraints, count, refineFrom }: {
      imageUrl: string; mode: RedesignMode; customPrompt?: string; excludedItems?: string[];
      constraints?: string; count?: number; refineFrom?: string;
    } = body

    if (!imageUrl || !mode) {
      return NextResponse.json({ message: '缺少必要参数' }, { status: 400 })
    }

    const validModes: RedesignMode[] = ['luxury-color', 'material-element', 'material-silhouette', 'commercial-brainstorm']
    if (!validModes.includes(mode)) {
      return NextResponse.json({ message: '无效的改款模式' }, { status: 400 })
    }

    const generateCount = Math.min(Math.max(count || 3, 1), 6)
    const creditCost = generateCount

    // 检查积分和 API Key
    const userInfo = queries.user.findCreditsAndApiKey(payload.userId)
    if (!userInfo || userInfo.credits < creditCost) {
      return NextResponse.json({ message: `积分不足（需要 ${creditCost} 积分），请联系管理员充值` }, { status: 403 })
    }

    if (!userInfo.apiKey) {
      return NextResponse.json({ message: '未配置 AI API Key，请联系管理员' }, { status: 403 })
    }
    const apiKey = decryptApiKey(userInfo.apiKey)
    if (!apiKey) {
      return NextResponse.json({ message: 'AI API Key 解密失败，请联系管理员重新设置' }, { status: 500 })
    }

    // 事务保护：扣积分 + 记录日志
    const deductResult = db.transaction(() => {
      const credits = queries.user.findCredits(payload.userId)
      if (credits === undefined || credits < creditCost) {
        return null
      }
      const newCredits = credits - creditCost
      db.prepare(`UPDATE User SET credits = ?, updatedAt = datetime('now') WHERE id = ?`).run(newCredits, payload.userId)
      db.prepare(
        'INSERT INTO CreditLog (id, userId, delta, balanceAfter, reason) VALUES (?, ?, ?, ?, ?)'
      ).run(uuidv4(), payload.userId, -creditCost, newCredits, MODE_LABELS[mode])
      return newCredits
    })()

    if (deductResult === null) {
      return NextResponse.json({ message: `积分不足（需要 ${creditCost} 积分），请联系管理员充值` }, { status: 403 })
    }

    // 执行改款
    const taskId = uuidv4()
    const ai = new AIService()

    try {
      let resultUrls: string[] = []
      let generatedItems: string[] = []
      const exclude = excludedItems || []
      const opts = { constraints: constraints || '', count: generateCount, refineFrom: refineFrom || '' }
      switch (mode) {
        case 'luxury-color':
          ({ resultUrls, generatedItems } = await ai.luxuryColorTransform(taskId, imageUrl, apiKey, exclude, opts))
          break
        case 'material-element':
          ({ resultUrls, generatedItems } = await ai.materialAwareElementAdd(taskId, imageUrl, apiKey, exclude, opts))
          break
        case 'material-silhouette':
          ({ resultUrls, generatedItems } = await ai.materialLockedSilhouetteChange(taskId, imageUrl, apiKey, exclude, opts))
          break
        case 'commercial-brainstorm':
          ({ resultUrls, generatedItems } = await ai.commercialBrainstorm(taskId, imageUrl, customPrompt, apiKey, exclude, opts))
          break
      }

      // 部分失败时按实际成功张数退还剩余积分（幂等退款，避免重试重复退）
      let finalCredits = deductResult
      const succeededCount = resultUrls.length
      const refundCount = generateCount - succeededCount
      if (refundCount > 0) {
        try {
          const refunded = CreditService.refundCreditsOnce(
            payload.userId,
            refundCount,
            `${taskId}:partial`,
            `改款部分失败退款 (${taskId.slice(0, 8)}) x${refundCount}`,
          )
          finalCredits = refunded.balance
        } catch (refundError) {
          console.error('[Redesign Partial Refund Error]', refundError)
        }
      }

      // 保存记录到 GenerationTask
      db.prepare(
        `INSERT INTO GenerationTask (id, userId, status, type, creditCost, clothingUrl, modelConfig, sceneConfig, resultUrl, resultUrls, clothingDescription, finishedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run(
        taskId, payload.userId, 'COMPLETED', 'redesign', succeededCount,
        imageUrl, '{}', '{}',
        resultUrls[0] || '', JSON.stringify(resultUrls),
        `${MODE_LABELS[mode]}${customPrompt ? ` | 自定义: ${customPrompt}` : ''}${generatedItems.length > 0 ? ` | 生成项: ${generatedItems.join(', ')}` : ''}`
      )

      return NextResponse.json({
        resultUrls,
        generatedItems,
        taskId,
        credits: finalCredits,
        partial: refundCount > 0 ? { requested: generateCount, succeeded: succeededCount, refunded: refundCount } : undefined,
      })
    } catch (aiError) {
      // AI 失败，退还积分（幂等，避免重试重复退）
      try {
        CreditService.refundCreditsOnce(
          payload.userId,
          creditCost,
          taskId,
          `改款失败退款 (${taskId.slice(0, 8)})`,
        )
      } catch (refundError) {
        console.error('[Redesign Refund Error]', refundError)
      }
      throw aiError
    }
  } catch (error) {
    console.error('[Redesign Error]', error)
    const message = error instanceof Error ? error.message : '改款生成失败'
    return NextResponse.json({ message }, { status: 500 })
  }
}
