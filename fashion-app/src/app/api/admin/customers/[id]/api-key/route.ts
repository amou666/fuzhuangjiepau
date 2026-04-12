import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken } from '@/lib/auth'
import { encryptApiKey, maskApiKey } from '@/lib/utils/security'
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
    const { apiKey } = await request.json()

    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json({ message: 'API Key 不能为空' }, { status: 400 })
    }

    const user = db.prepare('SELECT * FROM User WHERE id = ?').get(id) as any
    if (!user) {
      return NextResponse.json({ message: '用户不存在' }, { status: 404 })
    }

    const encryptedApiKey = encryptApiKey(apiKey.trim())

    // 检查 apiKey 是否已被其他用户使用（加密后比较）
    const existingUser = db.prepare('SELECT id FROM User WHERE apiKey = ? AND id != ?').get(encryptedApiKey, id) as any
    if (existingUser) {
      return NextResponse.json({ message: '该 API Key 已被其他用户使用，请换一个' }, { status: 409 })
    }

    db.prepare(`UPDATE User SET apiKey = ?, updatedAt = datetime('now') WHERE id = ?`).run(encryptedApiKey, id)

    db.prepare(
      'INSERT INTO AdminAuditLog (id, adminId, action, targetUserId, detail) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), payload.userId, 'update_api_key', id, `更新用户 ${user.email} 的 API Key`)

    const updatedUser = db.prepare('SELECT id, email, role, apiKey, credits, isActive, createdAt FROM User WHERE id = ?').get(id) as any
    return NextResponse.json({
      customer: {
        ...updatedUser,
        apiKey: maskApiKey(updatedUser?.apiKey),
      },
    })
  } catch (error) {
    console.error('[Admin Customer ApiKey Error]', error)
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ message: '该 API Key 已被其他用户使用，请换一个' }, { status: 409 })
    }
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ message: '更新 API Key 失败', detail }, { status: 500 })
  }
}
