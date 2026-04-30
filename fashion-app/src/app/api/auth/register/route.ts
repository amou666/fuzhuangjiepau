import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createAccessToken, createRefreshToken, hashPassword } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'
import { checkRateLimit } from '@/lib/rate-limit'
import { config } from '@/lib/config'

export async function POST(request: NextRequest) {
  try {
    if (!config.allowRegister) {
      return NextResponse.json({ message: '注册功能已关闭，请联系管理员开通账号' }, { status: 403 })
    }

    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown'
    const rl = checkRateLimit(`register:${ip}`, 10, 60_000)
    if (!rl.allowed) {
      return NextResponse.json({ message: '请求过于频繁，请稍后重试' }, { status: 429 })
    }

    const body = await request.json()
    const { email, password } = body ?? {}

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return NextResponse.json({ message: '请输入有效的邮箱和 6-128 位密码' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const existed = db.prepare('SELECT id FROM User WHERE email = ?').get(normalizedEmail)

    if (existed) {
      return NextResponse.json({ message: '该邮箱已注册' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)
    const id = uuidv4()

    db.prepare(
      'INSERT INTO User (id, email, password, role, apiKey, credits) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, normalizedEmail, passwordHash, 'CUSTOMER', null, 0)

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
