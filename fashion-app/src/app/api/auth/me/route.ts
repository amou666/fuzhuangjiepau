import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { maskApiKey } from '@/lib/utils/security'

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const user = db.prepare('SELECT id, email, role, apiKey, credits, isActive, createdAt FROM User WHERE id = ?').get(payload.userId) as any

    if (!user) {
      return NextResponse.json({ message: '用户不存在' }, { status: 404 })
    }

    return NextResponse.json({
      user: {
        ...user,
        apiKey: maskApiKey(user.apiKey),
        isActive: !!user.isActive,
      },
    })
  } catch (error) {
    return NextResponse.json({ message: '访问令牌已失效，请重新登录' }, { status: 401 })
  }
}
