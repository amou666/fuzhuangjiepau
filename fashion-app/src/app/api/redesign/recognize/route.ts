import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { AIService } from '@/lib/ai-service'

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

    const ai = new AIService()
    const materialInfo = await ai.recognizeMaterial(imageUrl, user.apiKey)

    return NextResponse.json({ materialInfo })
  } catch (error) {
    console.error('[Material Recognize Error]', error)
    const message = error instanceof Error ? error.message : '材质识别失败'
    return NextResponse.json({ message }, { status: 500 })
  }
}
