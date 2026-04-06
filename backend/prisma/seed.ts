import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { ensureBaseUsers } from '../src/services/bootstrapService';

const prisma = new PrismaClient();

const main = async () => {
  await ensureBaseUsers();
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
