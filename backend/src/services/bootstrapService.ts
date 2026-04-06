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
  const admin = await ensureUser(config.adminEmail, config.adminPassword, 'ADMIN', 0);
  const demo = await ensureUser(config.demoEmail, config.demoPassword, 'CUSTOMER', 60);

  // 首次运行时输出密码和密钥提示
  if (admin.createdAt === admin.updatedAt) {
    console.log('\n' + '='.repeat(60));
    console.log('🎉 系统首次初始化完成');
    console.log('='.repeat(60));
    
    if (config.isDefaultPassword) {
      console.log('\n默认账户信息（请妥善保存）：');
      console.log(`  管理员账户: ${config.adminEmail}`);
      console.log(`  管理员密码: ${config.adminPassword}`);
      console.log(`\n  演示账户: ${config.demoEmail}`);
      console.log(`  演示密码: ${config.demoPassword}`);
      console.log('\n⚠️  请立即修改默认密码或设置环境变量 ADMIN_PASSWORD 和 DEMO_PASSWORD');
    }
    
    if (config.isDefaultJwtSecret) {
      console.log('\n⚠️  警告：正在使用自动生成的 JWT 密钥');
      console.log('   生产环境请设置环境变量 JWT_SECRET 和 JWT_REFRESH_SECRET');
    }
    
    console.log('='.repeat(60) + '\n');
  }
};
