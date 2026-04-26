import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { v4 as uuidv4 } from 'uuid'
import { CreditService } from '@/lib/credit-service'
import { AIService } from '@/lib/ai-service'
import { decryptApiKey } from '@/lib/utils/security'

const BG_MODES: Record<string, { name: string; prompt: string; colorLiteral: string }> = {
  'studio-white': {
    name: '纯净白底',
    prompt: 'Transform this casual clothing photo into a professional ghost mannequin product shot on a pure white studio background. The garment should appear as if it is being worn by an invisible person, showing the 3D hollow shape, inner collar, and natural volume. CRITICAL: If the garment has sleeves, the sleeves MUST be fully inflated and puffed out to show realistic 3D arm volume — never flat, collapsed, or deflated. Remove hangers, hands, and all background clutter. Symmetrical and crisp edges.',
    colorLiteral: 'ABSOLUTE PURE DIGITAL WHITE (HEX #FFFFFF)',
  },
  'studio-grey': {
    name: '经典冷灰',
    prompt: 'Transform this casual clothing photo into a professional ghost mannequin product shot on a solid light grey studio background. The garment should appear as if it is being worn by an invisible person, maintaining its 3D volume and interior details. CRITICAL: If the garment has sleeves, the sleeves MUST be fully inflated and puffed out to show realistic 3D arm volume — never flat, collapsed, or deflated. Remove all original background elements. High-end fashion editorial quality.',
    colorLiteral: 'UNIFORM SOLID LIGHT GREY',
  },
  'studio-sand': {
    name: '高级杏色',
    prompt: 'Transform this casual clothing photo into a professional ghost mannequin product shot on a solid sand beige/almond background. The garment should appear as if it is being worn by an invisible person with natural fabric folds and volume. CRITICAL: If the garment has sleeves, the sleeves MUST be fully inflated and puffed out to show realistic 3D arm volume — never flat, collapsed, or deflated. Clean studio lighting, high-end fashion catalog style.',
    colorLiteral: 'UNIFORM SOLID SAND BEIGE',
  },
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const body = await request.json()
    const {
      imageUrl,
      styleId = 'studio-white',
      optimizePage = true,
      removeWatermark = true,
      enhanceDetails = true,
    }: {
      imageUrl: string
      styleId?: string
      optimizePage?: boolean
      removeWatermark?: boolean
      enhanceDetails?: boolean
    } = body

    if (!imageUrl) {
      return NextResponse.json({ message: '缺少图片 URL' }, { status: 400 })
    }

    const bgObj = BG_MODES[styleId]
    if (!bgObj) {
      return NextResponse.json({ message: '无效的风格选择' }, { status: 400 })
    }

    const creditCost = 1

    const user = db.prepare('SELECT credits, apiKey FROM User WHERE id = ?').get(payload.userId) as any
    if (!user || user.credits < creditCost) {
      return NextResponse.json({ message: `积分不足（需要 ${creditCost} 积分）` }, { status: 403 })
    }
    if (!user.apiKey) {
      return NextResponse.json({ message: '未配置 AI API Key' }, { status: 403 })
    }
    const apiKey = decryptApiKey(user.apiKey)
    if (!apiKey) {
      return NextResponse.json({ message: 'AI API Key 解密失败' }, { status: 500 })
    }

    const deductResult = CreditService.deductCredits(payload.userId, creditCost, '一键3D图')
    if (deductResult === null) {
      return NextResponse.json({ message: `积分不足（需要 ${creditCost} 积分）` }, { status: 403 })
    }

    const taskId = uuidv4()
    const ai = new AIService()

    try {
      // 构建 prompt
      let finalPrompt = bgObj.prompt
      finalPrompt += ` \n\nCRITICAL BACKGROUND OVERRIDE:
- You MUST completely discard and paint over the original background, walls, and any environmental light or shadows.
- The new background MUST be a 100% digital, flat, solid fill of ${bgObj.colorLiteral}.
- Ensure there are ZERO gray tints, ZERO room textures, and ZERO ambient occlusion from the original photo.`

      if (removeWatermark) {
        finalPrompt += ` \n\n- WATERMARK REMOVAL (URGENT): CRITICAL: Completely remove any visible watermarks, logos, text overlays, date stamps, or translucent text from both the clothing surface and the background. The final result must be clean and unbranded.`
      }
      if (optimizePage) {
        finalPrompt += ` \n\n- PAGE OPTIMIZATION: Center the garment perfectly in the canvas. Ensure equal padding on all sides for a professional catalog layout. Remove any peripheral distractions.`
      }
      if (enhanceDetails) {
        finalPrompt += ` \n\n- DETAIL ENHANCEMENT: Sharpen the fabric texture, enhance the clarity of seams and stitches, and ensure the 3D volume of the invisible mannequin is realistic and crisp.`
      }

      // 调用项目自己的 AI 接口
      const resultUrl = await ai.generateGhostMannequin(taskId, imageUrl, finalPrompt, apiKey)

      // 写入数据库
      db.prepare(
        `INSERT INTO GenerationTask (id, userId, status, type, creditCost, clothingUrl, modelConfig, sceneConfig, resultUrl, resultUrls, clothingDescription, finishedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run(
        taskId,
        payload.userId,
        'COMPLETED',
        'ghost-mannequin',
        creditCost,
        imageUrl,
        '{}',
        JSON.stringify({ styleId, styleName: bgObj.name }),
        resultUrl,
        JSON.stringify([resultUrl]),
        `一键3D图 | ${bgObj.name}`
      )

      return NextResponse.json({ resultUrl, taskId, credits: deductResult })
    } catch (aiError) {
      try {
        CreditService.refundCreditsOnce(payload.userId, creditCost, taskId, `3D图生成失败退款 (${taskId.slice(0, 8)})`)
      } catch {}
      throw aiError
    }
  } catch (error) {
    console.error('[GhostMannequin Error]', error)
    const message = error instanceof Error ? error.message : '生成失败'
    return NextResponse.json({ message }, { status: 500 })
  }
}
