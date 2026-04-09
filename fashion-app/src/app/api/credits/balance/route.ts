import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
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
