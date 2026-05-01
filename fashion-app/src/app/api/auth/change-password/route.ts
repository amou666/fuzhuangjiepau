import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { hashPassword, comparePassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || typeof currentPassword !== 'string') {
      return NextResponse.json({ message: '请输入当前密码' }, { status: 400 })
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json({ message: '新密码至少为 6 位' }, { status: 400 })
    }
    if (currentPassword === newPassword) {
      return NextResponse.json({ message: '新密码不能与当前密码相同' }, { status: 400 })
    }

    // 验证当前密码
    const user = db.prepare('SELECT password FROM User WHERE id = ?').get(payload.userId) as { password: string } | undefined
    if (!user) {
      return NextResponse.json({ message: '用户不存在' }, { status: 404 })
    }

    const matched = await comparePassword(currentPassword, user.password)
    if (!matched) {
      return NextResponse.json({ message: '当前密码错误' }, { status: 401 })
    }

    // 更新密码
    const passwordHash = await hashPassword(newPassword)
    db.prepare(`UPDATE User SET password = ?, updatedAt = datetime('now') WHERE id = ?`).run(passwordHash, payload.userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Change Password Error]', error)
    return NextResponse.json({ message: '修改密码失败，请稍后重试' }, { status: 500 })
  }
}
