import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { CreditService } from '@/lib/credit-service'
import { v4 as uuidv4 } from 'uuid'
import { AIService } from '@/lib/ai-service'

type RedesignMode = 'luxury-color' | 'material-element' | 'material-silhouette' | 'commercial-brainstorm'

const MODE_CREDITS: Record<RedesignMode, number> = {
  'luxury-color': 3,
  'material-element': 3,
  'material-silhouette': 3,
  'commercial-brainstorm': 3,
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
    const user = db.prepare('SELECT credits, apiKey FROM User WHERE id = ?').get(payload.userId) as any
    if (!user || user.credits < creditCost) {
      return NextResponse.json({ message: `积分不足（需要 ${creditCost} 积分），请联系管理员充值` }, { status: 403 })
    }

    if (!user.apiKey) {
      return NextResponse.json({ message: '未配置 AI API Key，请联系管理员' }, { status: 403 })
    }

    // 事务保护：扣积分 + 记录日志
    const deductResult = db.transaction(() => {
      const currentUser = db.prepare('SELECT credits FROM User WHERE id = ?').get(payload.userId) as any
      if (!currentUser || currentUser.credits < creditCost) {
        return null
      }
      const newCredits = currentUser.credits - creditCost
      db.prepare(`UPDATE User SET credits = ?, updatedAt = datetime('now') WHERE id = ?`).run(newCredits, payload.userId)
      const modeLabels: Record<RedesignMode, string> = {
        'luxury-color': '奢侈品色系变色',
        'material-element': '材质感知加元素',
        'material-silhouette': '材质锁定改款式',
        'commercial-brainstorm': '商业脑暴模式',
      }
      db.prepare(
        'INSERT INTO CreditLog (id, userId, delta, balanceAfter, reason) VALUES (?, ?, ?, ?, ?)'
      ).run(uuidv4(), payload.userId, -creditCost, newCredits, modeLabels[mode])
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
          ({ resultUrls, generatedItems } = await ai.luxuryColorTransform(taskId, imageUrl, user.apiKey, exclude, opts))
          break
        case 'material-element':
          ({ resultUrls, generatedItems } = await ai.materialAwareElementAdd(taskId, imageUrl, user.apiKey, exclude, opts))
          break
        case 'material-silhouette':
          ({ resultUrls, generatedItems } = await ai.materialLockedSilhouetteChange(taskId, imageUrl, user.apiKey, exclude, opts))
          break
        case 'commercial-brainstorm':
          ({ resultUrls, generatedItems } = await ai.commercialBrainstorm(taskId, imageUrl, customPrompt, user.apiKey, exclude, opts))
          break
      }

      // 保存记录到 GenerationTask
      const redesignLabels: Record<RedesignMode, string> = {
        'luxury-color': '奢侈品色系变色',
        'material-element': '材质感知加元素',
        'material-silhouette': '材质锁定改款式',
        'commercial-brainstorm': '商业脑暴模式',
      }
      db.prepare(
        `INSERT INTO GenerationTask (id, userId, status, type, creditCost, clothingUrl, modelConfig, sceneConfig, resultUrl, resultUrls, clothingDescription, finishedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run(
        taskId, payload.userId, 'COMPLETED', 'redesign', creditCost,
        imageUrl, '{}', '{}',
        resultUrls[0] || '', JSON.stringify(resultUrls),
        `${redesignLabels[mode]}${customPrompt ? ` | 自定义: ${customPrompt}` : ''}${generatedItems.length > 0 ? ` | 生成项: ${generatedItems.join(', ')}` : ''}`
      )

      return NextResponse.json({
        resultUrls,
        generatedItems,
        taskId,
        credits: deductResult,
      })
    } catch (aiError) {
      // AI 失败，退还积分
      try {
        CreditService.addCredits(payload.userId, creditCost, `改款失败退款 (${taskId.slice(0, 8)})`)
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
