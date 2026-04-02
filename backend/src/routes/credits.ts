import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AuditService } from '../services/auditService';
import { CreditService } from '../services/creditService';
import { toPositiveInt } from '../utils/validators';

export const creditsRouter = Router();
export const adminCreditsRouter = Router();

creditsRouter.get('/balance', async (req, res) => {
  const balance = await CreditService.getBalance(req.user!.userId);
  res.json({ balance });
});

creditsRouter.get('/history', async (req, res) => {
  const page = toPositiveInt(req.query.page as string) || 1;
  const limit = Math.min(toPositiveInt(req.query.limit as string) || 20, 100);
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;

  const result = await CreditService.getHistory(req.user!.userId, {
    page,
    limit,
    startDate,
    endDate,
  });

  res.json(result);
});

creditsRouter.get('/summary', async (req, res) => {
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;

  const summary = await CreditService.getSummary(req.user!.userId, startDate, endDate);
  res.json(summary);
});

adminCreditsRouter.post('/recharge', async (req, res) => {
  const { userId, amount } = req.body as { userId?: string; amount?: number };
  const parsedAmount = toPositiveInt(amount);

  if (!userId || parsedAmount === null) {
    res.status(400).json({ message: '请提供用户 ID 和大于 0 的整数充值积分' });
    return;
  }

  const existedUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, credits: true, role: true, isActive: true, apiKey: true, createdAt: true },
  });

  if (!existedUser || existedUser.role !== 'CUSTOMER') {
    res.status(404).json({ message: '客户不存在' });
    return;
  }

  const balance = await CreditService.addCredits(userId, parsedAmount);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, credits: true, role: true, isActive: true, apiKey: true, createdAt: true },
  });

  // 记录审计日志
  await AuditService.log({
    adminId: req.user!.userId,
    action: 'recharge_credits',
    targetUserId: userId,
    detail: `充值 ${parsedAmount} 积分给 ${existedUser.email}，操作后余额：${balance}`,
  });

  res.json({ user, balance });
});

adminCreditsRouter.get('/logs', async (_req, res) => {
  const logs = await prisma.creditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      user: {
        select: { email: true, role: true },
      },
    },
  });

  res.json({ logs });
});
