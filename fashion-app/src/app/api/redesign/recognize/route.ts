import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken } from '@/lib/auth'
import { AIService } from '@/lib/ai-service'

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

    const { imageUrl }: { imageUrl: string } = await request.json()
    if (!imageUrl) {
      return NextResponse.json({ message: '缺少图片 URL' }, { status: 400 })
    }

    const user = db.prepare('SELECT apiKey FROM User WHERE id = ?').get(payload.userId) as any
    if (!user?.apiKey) {
      return NextResponse.json({ message: '未配置 AI API Key' }, { status: 403 })
    }

    const ai = new AIService()
    const materialInfo = await ai.recognizeMaterial(imageUrl, user.apiKey)

    return NextResponse.json({ materialInfo })
  } catch (error) {
    console.error('[Material Recognize Error]', error)
    const message = error instanceof Error ? error.message : '材质识别失败'
    return NextResponse.json({ message }, { status: 500 })
  }
}
