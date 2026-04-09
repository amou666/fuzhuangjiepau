import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createAccessToken, createRefreshToken, hashPassword } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password || password.length < 6) {
      return NextResponse.json({ message: '请输入有效的邮箱和至少 6 位密码' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const existed = db.prepare('SELECT id FROM User WHERE email = ?').get(normalizedEmail)

    if (existed) {
      return NextResponse.json({ message: '该邮箱已注册' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)
    const id = uuidv4()
    const apiKey = uuidv4()

    db.prepare(
      'INSERT INTO User (id, email, password, role, apiKey, credits) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, normalizedEmail, passwordHash, 'CUSTOMER', apiKey, 0)

    const user = db.prepare('SELECT id, email, role, apiKey, credits, isActive, createdAt FROM User WHERE id = ?').get(id) as any

    return NextResponse.json({
      user: { ...user, isActive: !!user.isActive },
      accessToken: createAccessToken({ userId: user.id, email: user.email, role: user.role }),
      refreshToken: createRefreshToken(user.id),
    }, { status: 201 })
  } catch (error) {
    console.error('[Register Error]', error)
    return NextResponse.json({ message: '注册失败，请稍后重试' }, { status: 500 })
  }
}
