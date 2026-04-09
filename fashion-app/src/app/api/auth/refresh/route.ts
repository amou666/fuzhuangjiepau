import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createAccessToken, verifyRefreshToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json()

    if (!refreshToken) {
      return NextResponse.json({ message: '缺少 refreshToken' }, { status: 400 })
    }

    const payload = verifyRefreshToken(refreshToken)
    const user = db.prepare('SELECT id, email, role, isActive FROM User WHERE id = ?').get(payload.userId) as any

    if (!user || !user.isActive) {
      return NextResponse.json({ message: '用户不存在或已禁用' }, { status: 401 })
    }

    return NextResponse.json({
      accessToken: createAccessToken({ userId: user.id, email: user.email, role: user.role }),
    })
  } catch (error) {
    return NextResponse.json({ message: 'refreshToken 无效或已过期' }, { status: 401 })
  }
}
