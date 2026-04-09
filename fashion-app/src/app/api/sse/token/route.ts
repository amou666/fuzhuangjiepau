import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken } from '@/lib/auth'
import { createSseToken } from '@/lib/sse-tokens'

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

    const sseToken = createSseToken(payload.userId)

    return NextResponse.json({ sseToken })
  } catch (error) {
    console.error('[SSE Token Error]', error)
    return NextResponse.json({ message: '获取 SSE Token 失败' }, { status: 500 })
  }
}
