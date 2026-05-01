import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, isAuthed } from '@/lib/api-auth'
import { queries } from '@/lib/db-queries'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const { userId, amount } = await request.json()

    if (!userId || !amount || amount <= 0) {
      return NextResponse.json({ message: '参数无效' }, { status: 400 })
    }

    const parsedAmount = Number(amount)
    if (!Number.isFinite(parsedAmount) || !Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ message: '充值金额必须是正整数' }, { status: 400 })
    }

    const result = db.transaction(() => {
      const credits = queries.user.findCredits(userId)
      if (credits === undefined) return { error: '用户不存在', status: 404 }

      const newBalance = credits + parsedAmount
      db.prepare(`UPDATE User SET credits = ?, updatedAt = datetime('now') WHERE id = ?`).run(newBalance, userId)
      db.prepare(
        'INSERT INTO CreditLog (id, userId, delta, balanceAfter, reason) VALUES (?, ?, ?, ?, ?)'
      ).run(uuidv4(), userId, parsedAmount, newBalance, '管理员充值')
      db.prepare(
        'INSERT INTO AdminAuditLog (id, adminId, action, targetUserId, detail) VALUES (?, ?, ?, ?, ?)'
      ).run(uuidv4(), payload.userId, 'recharge_credits', userId, `充值 ${parsedAmount} 积分`)

      return { balance: newBalance }
    })()

    if ('error' in result) {
      return NextResponse.json({ message: result.error }, { status: result.status })
    }

    return NextResponse.json({ balance: result.balance })
  } catch (error) {
    console.error('[Admin Credits Recharge Error]', error)
    return NextResponse.json({ message: '充值失败' }, { status: 500 })
  }
}
