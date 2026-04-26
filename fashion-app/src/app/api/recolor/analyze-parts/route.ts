import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
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

    const user = db.prepare('SELECT apiKey FROM User WHERE id = ?').get(payload.userId) as any
    if (!user?.apiKey) {
      return NextResponse.json({ message: '未配置 AI API Key' }, { status: 403 })
    }
    const apiKey = decryptApiKey(user.apiKey)
    if (!apiKey) {
      return NextResponse.json({ message: 'AI API Key 解密失败，请联系管理员重新设置' }, { status: 500 })
    }

    const ai = new AIService()

    // 并行执行：材质识别 + 部件识别
    const [materialInfo, partsResult] = await Promise.all([
      ai.recognizeMaterial(imageUrl, apiKey).catch(() => ''),
      ai.analyzeGarmentParts(imageUrl, apiKey).catch(() => ({
        parts: [
          { id: 'body', name: '衣身主体', defaultChecked: true },
          { id: 'sleeve', name: '袖子', defaultChecked: true },
        ],
        currentColor: '未知',
      })),
    ])

    return NextResponse.json({
      parts: partsResult.parts,
      materialInfo,
      currentColor: partsResult.currentColor,
    })
  } catch (error) {
    console.error('[Analyze Parts Error]', error)
    const message = error instanceof Error ? error.message : '部件识别失败'
    return NextResponse.json({ message }, { status: 500 })
  }
}
