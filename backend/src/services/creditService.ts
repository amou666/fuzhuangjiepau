import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

const createLog = async (
  tx: Prisma.TransactionClient,
  userId: string,
  delta: number,
  reason: string,
) => {
  const user = await tx.user.update({
    where: { id: userId },
    data: { credits: { increment: delta } },
    select: { credits: true },
  });

  await tx.creditLog.create({
    data: {
      userId,
      delta,
      balanceAfter: user.credits,
      reason,
    },
  });

  return user.credits;
};

export class CreditService {
  static async preDeductCredits(userId: string, amount: number) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      if (user.credits < amount) {
        throw new Error('积分不足');
      }

      const balance = await createLog(tx, userId, -amount, 'generation_hold');
      return balance;
    });
  }

  static async addCredits(userId: string, amount: number, reason = 'admin_recharge') {
    if (amount <= 0) {
      throw new Error('充值积分必须大于 0');
    }

    return prisma.$transaction((tx) => createLog(tx, userId, amount, reason));
  }

  static async refundCredits(userId: string, amount: number, reason = 'generation_refund') {
    return prisma.$transaction((tx) => createLog(tx, userId, amount, reason));
  }

  static async logCreditChange(userId: string, delta: number, reason: string) {
    return prisma.$transaction((tx) => createLog(tx, userId, delta, reason));
  }

  static async getBalance(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });

    return user?.credits ?? 0;
  }

  static async getHistory(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CreditLogWhereInput = { userId };

    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = new Date(options.startDate);
      }
      if (options.endDate) {
        const end = new Date(options.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.creditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.creditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getSummary(userId: string, startDate?: string, endDate?: string) {
    const where: Prisma.CreditLogWhereInput = { userId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const logs = await prisma.creditLog.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    // 总消费（负数绝对值）
    const totalSpent = logs
      .filter((log) => log.delta < 0)
      .reduce((sum, log) => sum + Math.abs(log.delta), 0);

    // 总充值
    const totalRecharged = logs
      .filter((log) => log.delta > 0)
      .reduce((sum, log) => sum + log.delta, 0);

    // 按日期统计消费
    const dailyStats: Record<string, { spent: number; recharged: number }> = {};
    logs.forEach((log) => {
      const dateKey = log.createdAt.toISOString().split('T')[0];
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = { spent: 0, recharged: 0 };
      }
      if (log.delta < 0) {
        dailyStats[dateKey].spent += Math.abs(log.delta);
      } else {
        dailyStats[dateKey].recharged += log.delta;
      }
    });

    // 按类型分类统计
    const typeStats: Record<string, number> = {};
    logs.forEach((log) => {
      const type = log.reason.split('_')[0] || 'other';
      if (!typeStats[type]) {
        typeStats[type] = 0;
      }
      typeStats[type] += Math.abs(log.delta);
    });

    return {
      totalSpent,
      totalRecharged,
      dailyStats: Object.entries(dailyStats)
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      typeStats,
    };
  }
}
