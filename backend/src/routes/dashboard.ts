import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { serializeTask } from '../utils/taskSerializer';

const router = Router();

router.get('/', async (req, res) => {
  const startOfWindow = new Date();
  startOfWindow.setHours(0, 0, 0, 0);
  startOfWindow.setDate(startOfWindow.getDate() - 6);

  const [customerCount, taskCount, negativeLogs, recentTasks, recentWindowTasks, activeCustomers] = await Promise.all([
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.generationTask.count(),
    prisma.creditLog.findMany({
      where: { delta: { lt: 0 } },
      select: {
        delta: true,
        userId: true,
        user: {
          select: { email: true },
        },
      },
    }),
    prisma.generationTask.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { email: true } } },
    }),
    prisma.generationTask.findMany({
      where: { createdAt: { gte: startOfWindow } },
      select: { createdAt: true },
    }),
    prisma.generationTask.findMany({
      distinct: ['userId'],
      select: { userId: true },
    }),
  ]);

  const totalCreditsConsumed = negativeLogs.reduce((sum, log) => sum + Math.abs(log.delta), 0);

  const dailyCounts = new Map<string, number>();
  for (const task of recentWindowTasks) {
    const key = task.createdAt.toISOString().slice(0, 10);
    dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1);
  }

  const dailyTasks = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startOfWindow);
    date.setDate(startOfWindow.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    return { date: key, count: dailyCounts.get(key) ?? 0 };
  });

  const spentByUser = new Map<string, { email: string; spent: number }>();
  for (const log of negativeLogs) {
    const current = spentByUser.get(log.userId) ?? { email: log.user.email, spent: 0 };
    current.spent += Math.abs(log.delta);
    spentByUser.set(log.userId, current);
  }

  const topCustomers = Array.from(spentByUser.values())
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);

  res.json({
    summary: {
      customerCount,
      taskCount,
      totalCreditsConsumed,
      activeCustomerCount: activeCustomers.length,
    },
    dailyTasks,
    topCustomers,
    recentTasks: recentTasks.map((task) => serializeTask(task, req)),
  });
});

export default router;
