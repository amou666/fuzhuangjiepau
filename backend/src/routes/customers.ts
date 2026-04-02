import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { AuditService } from '../services/auditService';
import { CreditService } from '../services/creditService';
import { hasMinPasswordLength, isValidEmail, normalizeEmail, toOptionalNonNegativeInt } from '../utils/validators';

const router = Router();

const serializeCustomer = (customer: {
  id: string;
  email: string;
  apiKey: string;
  credits: number;
  isActive: boolean;
  createdAt: Date;
  taskCount?: number;
}) => ({
  id: customer.id,
  email: customer.email,
  apiKey: customer.apiKey,
  credits: customer.credits,
  isActive: customer.isActive,
  createdAt: customer.createdAt,
  taskCount: customer.taskCount ?? 0,
});

router.get('/', async (_req, res) => {
  const customers = await prisma.user.findMany({
    where: { role: 'CUSTOMER' },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { tasks: true } },
    },
  });

  res.json({
    customers: customers.map((customer) =>
      serializeCustomer({
        id: customer.id,
        email: customer.email,
        apiKey: customer.apiKey,
        credits: customer.credits,
        isActive: customer.isActive,
        createdAt: customer.createdAt,
        taskCount: customer._count.tasks,
      }),
    ),
  });
});

router.post('/', async (req, res) => {
  const { email, password, initialCredits, apiKey } = req.body as {
    email?: string;
    password?: string;
    initialCredits?: number;
    apiKey?: string;
  };
  const normalizedEmail = normalizeEmail(email ?? '');
  const parsedInitialCredits = toOptionalNonNegativeInt(initialCredits);

  if (!isValidEmail(normalizedEmail) || !password || !hasMinPasswordLength(password)) {
    res.status(400).json({ message: '请提供有效邮箱和至少 6 位密码' });
    return;
  }

  if (parsedInitialCredits === null) {
    res.status(400).json({ message: '初始积分必须是大于或等于 0 的整数' });
    return;
  }

  const existed = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existed) {
    res.status(409).json({ message: '该客户邮箱已存在' });
    return;
  }

  if (apiKey) {
    const apiKeyExisted = await prisma.user.findUnique({ where: { apiKey } });
    if (apiKeyExisted) {
      res.status(409).json({ message: '该 API Key 已被使用' });
      return;
    }
  }

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      password: await bcrypt.hash(password, 10),
      role: 'CUSTOMER',
      apiKey: apiKey || undefined,
    },
  });

  if (parsedInitialCredits > 0) {
    await CreditService.addCredits(user.id, parsedInitialCredits, 'customer_initial_credits');
  }

  const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

  // 记录审计日志
  await AuditService.log({
    adminId: req.user!.userId,
    action: 'create_customer',
    targetUserId: user.id,
    detail: `创建客户 ${normalizedEmail}，初始积分 ${parsedInitialCredits}`,
  });

  res.status(201).json({
    customer: serializeCustomer({
      id: updated.id,
      email: updated.email,
      apiKey: updated.apiKey,
      credits: updated.credits,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
    }),
  });
});

router.patch('/:id/status', async (req, res) => {
  const { isActive } = req.body as { isActive?: boolean };

  if (typeof isActive !== 'boolean') {
    res.status(400).json({ message: 'isActive 必须为布尔值' });
    return;
  }

  const existed = await prisma.user.findFirst({
    where: { id: req.params.id, role: 'CUSTOMER' },
  });

  if (!existed) {
    res.status(404).json({ message: '客户不存在' });
    return;
  }

  const customer = await prisma.user.update({
    where: { id: req.params.id },
    data: { isActive },
  });

  // 记录审计日志
  await AuditService.log({
    adminId: req.user!.userId,
    action: 'toggle_customer_status',
    targetUserId: req.params.id,
    detail: `将客户 ${existed.email} 状态修改为 ${isActive ? '启用' : '禁用'}`,
  });

  res.json({
    customer: serializeCustomer({
      id: customer.id,
      email: customer.email,
      apiKey: customer.apiKey,
      credits: customer.credits,
      isActive: customer.isActive,
      createdAt: customer.createdAt,
    }),
  });
});

router.patch('/:id/api-key', async (req, res) => {
  const { apiKey } = req.body as { apiKey?: string };

  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    res.status(400).json({ message: 'API Key 不能为空' });
    return;
  }

  const existed = await prisma.user.findFirst({
    where: { id: req.params.id, role: 'CUSTOMER' },
  });

  if (!existed) {
    res.status(404).json({ message: '客户不存在' });
    return;
  }

  const apiKeyExisted = await prisma.user.findUnique({ where: { apiKey: apiKey.trim() } });
  if (apiKeyExisted && apiKeyExisted.id !== req.params.id) {
    res.status(409).json({ message: '该 API Key 已被使用' });
    return;
  }

  const customer = await prisma.user.update({
    where: { id: req.params.id },
    data: { apiKey: apiKey.trim() },
  });

  // 记录审计日志
  await AuditService.log({
    adminId: req.user!.userId,
    action: 'update_api_key',
    targetUserId: req.params.id,
    detail: `更新客户 ${existed.email} 的 API Key`,
  });

  res.json({
    customer: serializeCustomer({
      id: customer.id,
      email: customer.email,
      apiKey: customer.apiKey,
      credits: customer.credits,
      isActive: customer.isActive,
      createdAt: customer.createdAt,
    }),
  });
});

export default router;
