import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
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

    const { userId, delta, reason } = await request.json()

    if (!userId || delta === undefined || !reason) {
      return NextResponse.json({ message: '缺少必要参数' }, { status: 400 })
    }

    const user = db.prepare('SELECT credits FROM User WHERE id = ?').get(userId) as any
    if (!user) {
      return NextResponse.json({ message: '用户不存在' }, { status: 404 })
    }

    const newBalance = user.credits + delta
    if (newBalance < 0) {
      return NextResponse.json({ message: '积分不足' }, { status: 400 })
    }

    // 更新积分
    db.prepare(`UPDATE User SET credits = ?, updatedAt = datetime('now') WHERE id = ?`).run(newBalance, userId)

    // 记录日志
    db.prepare(
      'INSERT INTO CreditLog (id, userId, delta, balanceAfter, reason) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), userId, delta, newBalance, reason)

    // 审计日志
    db.prepare(
      'INSERT INTO AdminAuditLog (id, adminId, action, targetUserId, detail) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), payload.userId, 'ADJUST_CREDITS', userId, `${reason} (积分变化: ${delta > 0 ? '+' : ''}${delta})`)

    return NextResponse.json({ balance: newBalance })
  } catch (error) {
    console.error('[Admin Credits Error]', error)
    return NextResponse.json({ message: '调整积分失败' }, { status: 500 })
  }
}
