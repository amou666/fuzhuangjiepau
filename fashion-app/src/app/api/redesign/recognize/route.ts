import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { AIService } from '@/lib/ai-service'
import { queries } from '@/lib/db-queries'
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

    const apiKey = queries.user.findApiKey(payload.userId)
    if (!apiKey) {
      return NextResponse.json({ message: '未配置 AI API Key' }, { status: 403 })
    }
    const decryptedKey = decryptApiKey(apiKey)
    if (!decryptedKey) {
      return NextResponse.json({ message: 'AI API Key 解密失败，请联系管理员重新设置' }, { status: 500 })
    }

    const ai = new AIService()
    const materialInfo = await ai.recognizeMaterial(imageUrl, decryptedKey)

    return NextResponse.json({ materialInfo })
  } catch (error) {
    console.error('[Material Recognize Error]', error)
    const message = error instanceof Error ? error.message : '材质识别失败'
    return NextResponse.json({ message }, { status: 500 })
  }
}
