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

    const { userId, delta, reason } = await request.json()

    if (!userId || delta === undefined || !reason) {
      return NextResponse.json({ message: '缺少必要参数' }, { status: 400 })
    }

    const parsedDelta = Number(delta)
    if (!Number.isFinite(parsedDelta) || !Number.isInteger(parsedDelta)) {
      return NextResponse.json({ message: '积分变动值必须是整数' }, { status: 400 })
    }

    const result = db.transaction(() => {
      const credits = queries.user.findCredits(userId)
      if (credits === undefined) return { error: '用户不存在', status: 404 }

      const newBalance = credits + parsedDelta
      if (newBalance < 0) return { error: '积分不足', status: 400 }

      db.prepare(`UPDATE User SET credits = ?, updatedAt = datetime('now') WHERE id = ?`).run(newBalance, userId)
      db.prepare(
        'INSERT INTO CreditLog (id, userId, delta, balanceAfter, reason) VALUES (?, ?, ?, ?, ?)'
      ).run(uuidv4(), userId, parsedDelta, newBalance, reason)
      db.prepare(
        'INSERT INTO AdminAuditLog (id, adminId, action, targetUserId, detail) VALUES (?, ?, ?, ?, ?)'
      ).run(uuidv4(), payload.userId, 'ADJUST_CREDITS', userId, `${reason} (积分变化: ${parsedDelta > 0 ? '+' : ''}${parsedDelta})`)

      return { balance: newBalance }
    })()

    if ('error' in result) {
      return NextResponse.json({ message: result.error }, { status: result.status })
    }

    return NextResponse.json({ balance: result.balance })
  } catch (error) {
    console.error('[Admin Credits Error]', error)
    return NextResponse.json({ message: '调整积分失败' }, { status: 500 })
  }
}
