import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { queries } from '@/lib/db-queries'

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const credits = queries.user.findCredits(payload.userId)
    if (credits === undefined) {
      return NextResponse.json({ message: '用户不存在' }, { status: 404 })
    }

    return NextResponse.json({ balance: credits })
  } catch (error) {
    console.error('[Credits Balance Error]', error)
    return NextResponse.json({ message: '获取积分失败' }, { status: 500 })
  }
}
