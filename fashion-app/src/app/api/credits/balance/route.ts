import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const user = db.prepare('SELECT credits FROM User WHERE id = ?').get(payload.userId) as any
    if (!user) {
      return NextResponse.json({ message: '用户不存在' }, { status: 404 })
    }

    return NextResponse.json({ balance: user.credits })
  } catch (error) {
    console.error('[Credits Balance Error]', error)
    return NextResponse.json({ message: '获取积分失败' }, { status: 500 })
  }
}
