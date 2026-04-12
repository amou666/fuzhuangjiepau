import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { createSseToken } from '@/lib/sse-tokens'

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const sseToken = createSseToken(payload.userId)

    return NextResponse.json({ sseToken })
  } catch (error) {
    console.error('[SSE Token Error]', error)
    return NextResponse.json({ message: '获取 SSE Token 失败' }, { status: 500 })
  }
}
