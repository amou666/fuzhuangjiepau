import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { auth } from '../middleware/auth';
import type { Role } from '../types';
import { createAccessToken, createRefreshToken, toJwtUser, verifyRefreshToken } from '../utils/auth';
import { hasMinPasswordLength, isValidEmail, normalizeEmail } from '../utils/validators';

const router = Router();

const serializeUser = (user: {
  id: string;
  email: string;
  role: Role;
  credits: number;
  apiKey: string;
  isActive: boolean;
  createdAt: Date;
}) => ({
  id: user.id,
  email: user.email,
  role: user.role,
  credits: user.credits,
  apiKey: user.apiKey,
  isActive: user.isActive,
  createdAt: user.createdAt,
});

router.post('/register', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const normalizedEmail = normalizeEmail(email ?? '');

  if (!isValidEmail(normalizedEmail) || !password || !hasMinPasswordLength(password)) {
    res.status(400).json({ message: '请输入有效的邮箱和至少 6 位密码' });
    return;
  }

  const existed = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existed) {
    res.status(409).json({ message: '该邮箱已注册' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      password: passwordHash,
      role: 'CUSTOMER',
    },
  });

  const jwtUser = toJwtUser(user as { id: string; email: string; role: Role });
  res.status(201).json({
    user: serializeUser(user as typeof user & { role: Role }),
    accessToken: createAccessToken(jwtUser),
    refreshToken: createRefreshToken(user.id),
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const normalizedEmail = normalizeEmail(email ?? '');

  if (!isValidEmail(normalizedEmail) || !password) {
    res.status(400).json({ message: '请输入有效邮箱和密码' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    res.status(401).json({ message: '邮箱或密码错误' });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ message: '账号已被禁用' });
    return;
  }

  const matched = await bcrypt.compare(password, user.password);
  if (!matched) {
    res.status(401).json({ message: '邮箱或密码错误' });
    return;
  }

  const typedUser = user as typeof user & { role: Role };
  res.json({
    user: serializeUser(typedUser),
    accessToken: createAccessToken(toJwtUser(typedUser)),
    refreshToken: createRefreshToken(user.id),
  });
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };

  if (!refreshToken) {
    res.status(400).json({ message: '缺少 refreshToken' });
    return;
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user || !user.isActive) {
      res.status(401).json({ message: '用户不存在或已禁用' });
      return;
    }

    res.json({ accessToken: createAccessToken(toJwtUser(user as typeof user & { role: Role })) });
  } catch {
    res.status(401).json({ message: 'refreshToken 无效或已过期' });
  }
});

router.get('/me', auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });

  if (!user) {
    res.status(404).json({ message: '用户不存在' });
    return;
  }

  res.json({ user: serializeUser(user as typeof user & { role: Role }) });
});

export default router;
