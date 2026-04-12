import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, isAuthed } from '@/lib/api-auth'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const body = await request.json() as { userIds: string[]; amount: number }
    const rawAmount = Number(body.amount)
    if (!Array.isArray(body.userIds) || body.userIds.length === 0 || !Number.isFinite(rawAmount) || rawAmount <= 0 || !Number.isInteger(rawAmount)) {
      return NextResponse.json({ message: '参数无效' }, { status: 400 })
    }
    const userIds = [...new Set(body.userIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
    const amount = rawAmount
    if (userIds.length === 0) {
      return NextResponse.json({ message: '参数无效' }, { status: 400 })
    }
    if (userIds.length > 100) {
      return NextResponse.json({ message: '单次最多 100 人' }, { status: 400 })
    }

    const results: { userId: string; email: string; newBalance: number }[] = []

    const batchRecharge = db.transaction(() => {
      for (const uid of userIds) {
        const user = db.prepare('SELECT id, email, credits FROM User WHERE id = ?').get(uid) as any
        if (!user) continue
        const newBalance = user.credits + amount
        db.prepare(`UPDATE User SET credits = ?, updatedAt = datetime('now') WHERE id = ?`).run(newBalance, uid)
        db.prepare(
          'INSERT INTO CreditLog (id, userId, delta, balanceAfter, reason) VALUES (?, ?, ?, ?, ?)'
        ).run(uuidv4(), uid, amount, newBalance, '管理员批量充值')

        db.prepare(
          'INSERT INTO Notification (id, userId, type, title, content) VALUES (?, ?, ?, ?, ?)'
        ).run(uuidv4(), uid, 'credit', '积分充值到账', `管理员为您充值了 ${amount} 积分，当前余额 ${newBalance}`)

        results.push({ userId: uid, email: user.email, newBalance })
      }

      db.prepare(
        'INSERT INTO AdminAuditLog (id, adminId, action, detail) VALUES (?, ?, ?, ?)'
      ).run(uuidv4(), payload.userId, 'batch_recharge', `批量充值 ${userIds.length} 人，每人 ${amount} 积分`)
    })

    batchRecharge()

    return NextResponse.json({ results, count: results.length })
  } catch (error) {
    console.error('[Admin Batch Recharge Error]', error)
    return NextResponse.json({ message: '批量充值失败' }, { status: 500 })
  }
}
