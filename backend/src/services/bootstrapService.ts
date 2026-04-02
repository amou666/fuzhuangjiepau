import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { CreditService } from './creditService';

const ensureUser = async (email: string, password: string, role: 'ADMIN' | 'CUSTOMER', credits: number) => {
  const existed = await prisma.user.findUnique({ where: { email } });
  if (existed) {
    return existed;
  }

  const user = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(password, 10),
      role,
    },
  });

  if (credits > 0) {
    await CreditService.addCredits(user.id, credits, 'seed_credits');
  }

  return prisma.user.findUniqueOrThrow({ where: { id: user.id } });
};

export const ensureBaseUsers = async () => {
  await ensureUser(config.adminEmail, config.adminPassword, 'ADMIN', 0);
  await ensureUser(config.demoEmail, config.demoPassword, 'CUSTOMER', 60);
};
