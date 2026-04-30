import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { requireAdmin, isAuthed } from '@/lib/api-auth'
import { decryptApiKey, encryptApiKey, maskApiKey } from '@/lib/utils/security'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: NextRequest) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit
    const search = searchParams.get('search') || ''

    let whereClause = ''
    const params: any[] = []
    if (search) {
      whereClause = 'WHERE email LIKE ?'
      params.push(`%${search}%`)
    }

    const total = (db.prepare(`SELECT COUNT(*) as count FROM User ${whereClause}`).get(...params) as any).count
    const users = db.prepare(
      `SELECT id, email, role, apiKey, credits, isActive, createdAt FROM User ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset)

    // 为每个用户添加 taskCount
    const customers = users.map((u: any) => {
      const taskCount = (db.prepare('SELECT COUNT(*) as count FROM GenerationTask WHERE userId = ?').get(u.id) as any).count
      return {
        ...u,
        apiKey: maskApiKey(u.apiKey),
        isActive: !!u.isActive,
        taskCount,
      }
    })

    return NextResponse.json({
      customers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('[Admin Customers Error]', error)
    return NextResponse.json({ message: '获取用户列表失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const { email, password, initialCredits = 0, apiKey } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ message: '请输入邮箱和密码' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const existing = db.prepare('SELECT id FROM User WHERE email = ?').get(normalizedEmail)
    if (existing) {
      return NextResponse.json({ message: '邮箱已存在' }, { status: 409 })
    }

    const id = uuidv4()
    const trimmedApiKey = apiKey?.trim() || ''

    // 检查 apiKey 是否已被使用（需对加密后的 key 做唯一性检查）
    let storedApiKey: string | null = null
    if (trimmedApiKey) {
      const encryptedKey = encryptApiKey(trimmedApiKey)
      const existingKey = db.prepare('SELECT id FROM User WHERE apiKey = ?').get(encryptedKey) as any
      if (existingKey) {
        return NextResponse.json({ message: '该 API Key 已被其他用户使用，请换一个' }, { status: 409 })
      }
      storedApiKey = encryptedKey
    }

    const passwordHash = await hashPassword(password)
    db.prepare(
      'INSERT INTO User (id, email, password, role, apiKey, credits) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, normalizedEmail, passwordHash, 'CUSTOMER', storedApiKey, initialCredits)

    db.prepare(
      'INSERT INTO AdminAuditLog (id, adminId, action, targetUserId, detail) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), payload.userId, 'create_customer', id, `创建客户 ${normalizedEmail}`)

    return NextResponse.json({
      customer: { id, email: normalizedEmail, role: 'CUSTOMER', apiKey: storedApiKey, credits: initialCredits, isActive: true, taskCount: 0 },
    }, { status: 201 })
  } catch (error) {
    console.error('[Admin Customers POST Error]', error)
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ message: '该 API Key 已被其他用户使用，请换一个' }, { status: 409 })
    }
    return NextResponse.json({ message: '创建客户失败' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const { userId, credits, isActive, role } = await request.json()

    if (!userId) {
      return NextResponse.json({ message: '缺少用户ID' }, { status: 400 })
    }

    const user = db.prepare('SELECT * FROM User WHERE id = ?').get(userId) as any
    if (!user) {
      return NextResponse.json({ message: '用户不存在' }, { status: 404 })
    }

    if (credits !== undefined) {
      const delta = credits - user.credits
      db.prepare(`UPDATE User SET credits = ?, updatedAt = datetime('now') WHERE id = ?`).run(credits, userId)
      db.prepare(
        'INSERT INTO CreditLog (id, userId, delta, balanceAfter, reason) VALUES (?, ?, ?, ?, ?)'
      ).run(uuidv4(), userId, delta, credits, `管理员 ${payload.email} 调整积分`)
    }

    if (isActive !== undefined) {
      db.prepare("UPDATE User SET isActive = ?, updatedAt = datetime('now') WHERE id = ?").run(isActive ? 1 : 0, userId)
    }

    if (role !== undefined) {
      if (!['ADMIN', 'CUSTOMER'].includes(role)) {
        return NextResponse.json({ message: '无效的角色值' }, { status: 400 })
      }
      db.prepare(`UPDATE User SET role = ?, updatedAt = datetime('now') WHERE id = ?`).run(role, userId)
    }

    db.prepare(
      'INSERT INTO AdminAuditLog (id, adminId, action, targetUserId, detail) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), payload.userId, 'UPDATE_USER', userId, `更新用户: ${JSON.stringify({ credits, isActive, role })}`)

    const updatedUser = db.prepare('SELECT id, email, role, apiKey, credits, isActive, createdAt FROM User WHERE id = ?').get(userId) as any
    const taskCount = (db.prepare('SELECT COUNT(*) as count FROM GenerationTask WHERE userId = ?').get(userId) as any).count

    return NextResponse.json({ user: { ...updatedUser, isActive: !!updatedUser.isActive, taskCount } })
  } catch (error) {
    console.error('[Admin Customers PUT Error]', error)
    return NextResponse.json({ message: '更新用户失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const { userId } = await request.json()
    if (!userId) {
      return NextResponse.json({ message: '缺少用户ID' }, { status: 400 })
    }

    if (userId === payload.userId) {
      return NextResponse.json({ message: '不能删除自己' }, { status: 400 })
    }

    db.prepare('DELETE FROM CreditLog WHERE userId = ?').run(userId)
    db.prepare('DELETE FROM GenerationTask WHERE userId = ?').run(userId)
    db.prepare('DELETE FROM User WHERE id = ?').run(userId)

    db.prepare(
      'INSERT INTO AdminAuditLog (id, adminId, action, targetUserId, detail) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), payload.userId, 'DELETE_USER', userId, '删除用户及关联数据')

    return NextResponse.json({ message: '已删除' })
  } catch (error) {
    console.error('[Admin Customers DELETE Error]', error)
    return NextResponse.json({ message: '删除用户失败' }, { status: 500 })
  }
}
