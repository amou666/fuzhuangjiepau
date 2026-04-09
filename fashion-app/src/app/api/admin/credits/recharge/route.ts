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

    const { userId, amount } = await request.json()

    if (!userId || !amount || amount <= 0) {
      return NextResponse.json({ message: '参数无效' }, { status: 400 })
    }

    const user = db.prepare('SELECT credits FROM User WHERE id = ?').get(userId) as any
    if (!user) {
      return NextResponse.json({ message: '用户不存在' }, { status: 404 })
    }

    const newBalance = user.credits + amount
    db.prepare(`UPDATE User SET credits = ?, updatedAt = datetime('now') WHERE id = ?`).run(newBalance, userId)
    db.prepare(
      'INSERT INTO CreditLog (id, userId, delta, balanceAfter, reason) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), userId, amount, newBalance, '管理员充值')
    db.prepare(
      'INSERT INTO AdminAuditLog (id, adminId, action, targetUserId, detail) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), payload.userId, 'recharge_credits', userId, `充值 ${amount} 积分`)

    return NextResponse.json({ balance: newBalance })
  } catch (error) {
    console.error('[Admin Credits Recharge Error]', error)
    return NextResponse.json({ message: '充值失败' }, { status: 500 })
  }
}
