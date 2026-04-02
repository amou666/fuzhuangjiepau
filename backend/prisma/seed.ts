import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const main = async () => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@fashionai.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  const demoEmail = process.env.DEMO_EMAIL || 'demo@fashionai.local';
  const demoPassword = process.env.DEMO_PASSWORD || 'Demo123!';

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const demoHash = await bcrypt.hash(demoPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: adminHash,
      role: 'ADMIN',
    },
  });

  const demo = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {},
    create: {
      email: demoEmail,
      password: demoHash,
      role: 'CUSTOMER',
      credits: 60,
    },
  });

  const existingSeedLog = await prisma.creditLog.findFirst({ where: { userId: demo.id, reason: 'seed_credits' } });
  if (!existingSeedLog) {
    await prisma.creditLog.create({
      data: {
        userId: demo.id,
        delta: 60,
        balanceAfter: demo.credits,
        reason: 'seed_credits',
      },
    });
  }
};

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
