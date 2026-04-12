import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { getWatermarkConfig } from '@/lib/watermark'

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth

    const config = getWatermarkConfig()
    return NextResponse.json({
      enabled: config.enabled,
      text: config.text,
      position: config.position,
      opacity: config.opacity,
      fontSize: config.fontSize,
    })
  } catch (error) {
    console.error('[Watermark Config Error]', error)
    return NextResponse.json({ message: '获取水印配置失败' }, { status: 500 })
  }
}
