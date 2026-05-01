import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, isAuthed } from '@/lib/api-auth'
import { queries } from '@/lib/db-queries'
import { hashPassword } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const { id } = await params
    const { password } = await request.json()

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ message: '新密码至少为 6 位' }, { status: 400 })
    }

    const user = queries.user.findById(id)
    if (!user) {
      return NextResponse.json({ message: '用户不存在' }, { status: 404 })
    }

    const passwordHash = await hashPassword(password)
    db.prepare(`UPDATE User SET password = ?, updatedAt = datetime('now') WHERE id = ?`).run(passwordHash, id)

    db.prepare(
      'INSERT INTO AdminAuditLog (id, adminId, action, targetUserId, detail) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), payload.userId, 'reset_customer_password', id, `重置用户 ${user.email} 的密码`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin Reset Password Error]', error)
    return NextResponse.json({ message: '重置密码失败' }, { status: 500 })
  }
}
