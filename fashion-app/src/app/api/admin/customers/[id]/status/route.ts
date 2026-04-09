import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: '未授权' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const payload = verifyAccessToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ message: '仅管理员可操作' }, { status: 403 })
    }

    const { id } = await params
    const { isActive } = await request.json()

    if (isActive === undefined) {
      return NextResponse.json({ message: '缺少 isActive 参数' }, { status: 400 })
    }

    const user = db.prepare('SELECT * FROM User WHERE id = ?').get(id) as any
    if (!user) {
      return NextResponse.json({ message: '用户不存在' }, { status: 404 })
    }

    db.prepare(`UPDATE User SET isActive = ?, updatedAt = datetime('now') WHERE id = ?`).run(isActive ? 1 : 0, id)

    db.prepare(
      'INSERT INTO AdminAuditLog (id, adminId, action, targetUserId, detail) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), payload.userId, 'toggle_customer_status', id, `${isActive ? '启用' : '禁用'}用户 ${user.email}`)

    const updatedUser = db.prepare('SELECT id, email, role, apiKey, credits, isActive, createdAt FROM User WHERE id = ?').get(id)
    return NextResponse.json({ customer: updatedUser })
  } catch (error) {
    console.error('[Admin Customer Status Error]', error)
    return NextResponse.json({ message: '更新状态失败' }, { status: 500 })
  }
}
