import { db } from './db'
import { v4 as uuidv4 } from 'uuid'

export class CreditService {
  static addCredits(userId: string, amount: number, reason = 'admin_recharge'): number {
    if (amount <= 0) throw new Error('充值积分必须大于 0')

    const user = db.prepare('SELECT credits FROM User WHERE id = ?').get(userId) as any
    if (!user) throw new Error('用户不存在')

    const newBalance = user.credits + amount
    db.prepare(`UPDATE User SET credits = ?, updatedAt = datetime('now') WHERE id = ?`).run(newBalance, userId)
    db.prepare(
      'INSERT INTO CreditLog (id, userId, delta, balanceAfter, reason) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), userId, amount, newBalance, reason)

    return newBalance
  }

  static deductCredits(userId: string, amount: number, reason = '任务扣费'): number | null {
    if (amount <= 0) throw new Error('扣减积分必须大于 0')

    return db.transaction(() => {
      const user = db.prepare('SELECT credits FROM User WHERE id = ?').get(userId) as any
      if (!user || user.credits < amount) {
        return null
      }

      const newBalance = user.credits - amount
      db.prepare(`UPDATE User SET credits = ?, updatedAt = datetime('now') WHERE id = ?`).run(newBalance, userId)
      db.prepare(
        'INSERT INTO CreditLog (id, userId, delta, balanceAfter, reason) VALUES (?, ?, ?, ?, ?)'
      ).run(uuidv4(), userId, -amount, newBalance, reason)

      return newBalance
    })()
  }

  static refundCreditsOnce(
    userId: string,
    amount: number,
    refundKey: string,
    reason = '任务失败退款'
  ): { refunded: boolean; balance: number } {
    if (!refundKey.trim()) throw new Error('refundKey 不能为空')
    if (amount <= 0) throw new Error('退款积分必须大于 0')

    return db.transaction(() => {
      const lockReason = `task:${refundKey}`
      const existing = db
        .prepare('SELECT id FROM CreditLog WHERE userId = ? AND reason = ? LIMIT 1')
        .get(userId, lockReason) as any

      if (existing) {
        const balance = this.getBalance(userId)
        return { refunded: false, balance }
      }

      const user = db.prepare('SELECT credits FROM User WHERE id = ?').get(userId) as any
      if (!user) throw new Error('用户不存在')

      const newBalance = user.credits + amount
      db.prepare(`UPDATE User SET credits = ?, updatedAt = datetime('now') WHERE id = ?`).run(newBalance, userId)

      // 先写幂等锁日志，再写可读业务日志
      db.prepare(
        'INSERT INTO CreditLog (id, userId, delta, balanceAfter, reason) VALUES (?, ?, ?, ?, ?)'
      ).run(uuidv4(), userId, 0, newBalance, lockReason)

      db.prepare(
        'INSERT INTO CreditLog (id, userId, delta, balanceAfter, reason) VALUES (?, ?, ?, ?, ?)'
      ).run(uuidv4(), userId, amount, newBalance, reason)

      return { refunded: true, balance: newBalance }
    })()
  }

  static getBalance(userId: string): number {
    const user = db.prepare('SELECT credits FROM User WHERE id = ?').get(userId) as any
    return user?.credits ?? 0
  }

  static getHistory(
    userId: string,
    options?: {
      page?: number
      limit?: number
      startDate?: string
      endDate?: string
    }
  ) {
    const page = options?.page || 1
    const limit = options?.limit || 20
    const offset = (page - 1) * limit

    let whereClause = 'WHERE cl.userId = ?'
    const params: any[] = [userId]

    if (options?.startDate) {
      whereClause += ' AND cl.createdAt >= ?'
      params.push(options.startDate)
    }
    if (options?.endDate) {
      whereClause += ' AND cl.createdAt <= ?'
      params.push(options.endDate + ' 23:59:59')
    }

    // 过滤幂等锁日志，只保留业务可读流水
    whereClause += " AND cl.reason NOT LIKE 'task:%'"

    const total = (db.prepare(`SELECT COUNT(*) as count FROM CreditLog cl ${whereClause}`).get(...params) as any).count
    const logs = db.prepare(
      `SELECT cl.*, u.email as userEmail FROM CreditLog cl LEFT JOIN User u ON cl.userId = u.id ${whereClause} ORDER BY cl.createdAt DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset)

    return {
      logs: logs.map((l: any) => ({
        ...l,
        user: l.userEmail ? { email: l.userEmail } : undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }
}
