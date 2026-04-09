import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken, extractTokenFromHeader } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization'))

    if (!token) {
      return NextResponse.json({ message: '未提供有效的访问令牌' }, { status: 401 })
    }

    const payload = verifyAccessToken(token)
    const user = db.prepare('SELECT id, email, role, apiKey, credits, isActive, createdAt FROM User WHERE id = ?').get(payload.userId) as any

    if (!user) {
      return NextResponse.json({ message: '用户不存在' }, { status: 404 })
    }

    return NextResponse.json({
      user: { ...user, isActive: !!user.isActive },
    })
  } catch (error) {
    return NextResponse.json({ message: '访问令牌已失效，请重新登录' }, { status: 401 })
  }
}
