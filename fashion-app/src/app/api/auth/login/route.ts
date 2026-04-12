import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createAccessToken, createRefreshToken, comparePassword } from '@/lib/auth'
import { maskApiKey } from '@/lib/utils/security'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown'
    const rl = checkRateLimit(`login:${ip}`, 10, 60_000)
    if (!rl.allowed) {
      return NextResponse.json({ message: '请求过于频繁，请稍后重试' }, { status: 429 })
    }

    const body = await request.json()
    const { email, password } = body ?? {}

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json({ message: '请输入有效邮箱和密码' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const user = db.prepare('SELECT * FROM User WHERE email = ?').get(normalizedEmail) as any

    if (!user) {
      return NextResponse.json({ message: '邮箱或密码错误' }, { status: 401 })
    }

    if (!user.isActive) {
      return NextResponse.json({ message: '账号已被禁用' }, { status: 403 })
    }

    const matched = await comparePassword(password, user.password)
    if (!matched) {
      return NextResponse.json({ message: '邮箱或密码错误' }, { status: 401 })
    }

    const userResponse = {
      id: user.id,
      email: user.email,
      role: user.role,
      apiKey: maskApiKey(user.apiKey),
      credits: user.credits,
      isActive: !!user.isActive,
      createdAt: user.createdAt,
    }

    return NextResponse.json({
      user: userResponse,
      accessToken: createAccessToken({ userId: user.id, email: user.email, role: user.role }),
      refreshToken: createRefreshToken(user.id),
    })
  } catch (error) {
    console.error('[Login Error]', error)
    return NextResponse.json({ message: '登录失败，请稍后重试' }, { status: 500 })
  }
}
