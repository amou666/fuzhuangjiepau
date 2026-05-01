import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, isAuthed } from '@/lib/api-auth'
import { queries } from '@/lib/db-queries'
import { encryptApiKey, maskApiKey } from '@/lib/utils/security'
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
    const { apiKey } = await request.json()

    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json({ message: 'API Key 不能为空' }, { status: 400 })
    }

    const user = queries.user.findById(id)
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

    const updatedUser = queries.user.findById(id)
    return NextResponse.json({
      customer: {
        ...updatedUser,
        apiKey: maskApiKey(updatedUser?.apiKey ?? null),
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
