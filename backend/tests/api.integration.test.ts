import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app, { initializeApp } from '../src/app';
import { config } from '../src/config';
import { prisma } from '../src/lib/prisma';
import { ensureBaseUsers } from '../src/services/bootstrapService';
import { ensureUploadDirectories } from '../src/utils/files';

const api = request(app);
const hostHeader = '127.0.0.1:3101';
const testDatabaseFile = path.resolve(process.cwd(), 'prisma/test.db');
const testDatabaseJournalFile = path.resolve(process.cwd(), 'prisma/test.db-journal');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const makeEmail = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@fashionai.local`;

const sampleModelConfig = {
  mode: 'generate',
  gender: 'female',
  skinTone: 'natural',
  bodyType: 'slim',
  pose: 'street walk',
  expression: 'soft smile',
};

const sampleSceneConfig = {
  mode: 'preset',
  preset: 'city street',
  prompt: 'golden hour',
};

const resetUploads = async () => {
  await fs.rm(config.uploadDir, { recursive: true, force: true });
  ensureUploadDirectories();
};

const resetDatabase = async () => {
  await prisma.creditLog.deleteMany();
  await prisma.generationTask.deleteMany();
  await prisma.user.deleteMany();
  await resetUploads();
  await ensureBaseUsers();
};

const login = async (email: string, password: string) => {
  const response = await api.post('/api/auth/login').send({ email, password });
  expect(response.status).toBe(200);
  return response.body.accessToken as string;
};

const registerCustomer = async (email = makeEmail('customer')) => {
  const response = await api.post('/api/auth/register').send({ email, password: 'Qa123456' });
  expect(response.status).toBe(201);
  return {
    email: response.body.user.email as string,
    id: response.body.user.id as string,
    accessToken: response.body.accessToken as string,
    refreshToken: response.body.refreshToken as string,
  };
};

const rechargeCustomer = async (adminToken: string, userId: string, amount: number) => {
  const response = await api
    .post('/api/admin/credits/recharge')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ userId, amount });

  expect(response.status).toBe(200);
  return response.body;
};

const waitForTaskToFinish = async (accessToken: string, taskId: string) => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await api
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('host', hostHeader);

    expect(response.status).toBe(200);

    if (response.body.task.status === 'DONE' || response.body.task.status === 'FAILED') {
      return response.body.task;
    }

    await sleep(400);
  }

  throw new Error('任务未在预期时间内完成');
};

beforeAll(async () => {
  await fs.rm(testDatabaseFile, { force: true });
  await fs.rm(testDatabaseJournalFile, { force: true });

  execSync('npx prisma db push --skip-generate', {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'pipe',
  });

  await initializeApp();
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
  await fs.rm(testDatabaseFile, { force: true });
  await fs.rm(testDatabaseJournalFile, { force: true });
  await fs.rm(config.uploadDir, { recursive: true, force: true });
});

describe('API 自动化集成测试', () => {
  it('注册接口会校验邮箱并标准化保存邮箱', async () => {
    const invalidResponse = await api.post('/api/auth/register').send({
      email: 'not-an-email',
      password: 'Qa123456',
    });

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.message).toBe('请输入有效的邮箱和至少 6 位密码');

    const registerResponse = await api.post('/api/auth/register').send({
      email: '  MixedUser@FashionAI.local ',
      password: 'Qa123456',
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.user.email).toBe('mixeduser@fashionai.local');

    const duplicateResponse = await api.post('/api/auth/register').send({
      email: 'mixeduser@fashionai.local',
      password: 'Qa123456',
    });

    expect(duplicateResponse.status).toBe(409);
  });

  it('管理员可创建客户，负数充值会返回 400', async () => {
    const adminToken = await login('admin@fashionai.local', 'Admin123!');
    const customerEmail = makeEmail('admin-created');

    const createResponse = await api
      .post('/api/admin/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: ` ${customerEmail.toUpperCase()} `,
        password: 'Qa123456',
        initialCredits: 8,
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.customer.email).toBe(customerEmail);
    expect(createResponse.body.customer.credits).toBe(8);

    const invalidRechargeResponse = await api
      .post('/api/admin/credits/recharge')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: createResponse.body.customer.id,
        amount: -1,
      });

    expect(invalidRechargeResponse.status).toBe(400);
    expect(invalidRechargeResponse.body.message).toBe('请提供用户 ID 和大于 0 的整数充值积分');
  });

  it('上传接口支持合法图片并拦截非法类型和超大文件', async () => {
    const customer = await registerCustomer();

    const validUploadResponse = await api
      .post('/api/uploads/image')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .set('host', hostHeader)
      .attach('image', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"></svg>'), {
        filename: 'garment.svg',
        contentType: 'image/svg+xml',
      });

    expect(validUploadResponse.status).toBe(201);
    expect(validUploadResponse.body.url).toMatch(/^http:\/\/127\.0\.0\.1:3101\/uploads\//);

    const invalidTypeResponse = await api
      .post('/api/uploads/image')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .attach('image', Buffer.from('not-an-image'), {
        filename: 'garment.txt',
        contentType: 'text/plain',
      });

    expect(invalidTypeResponse.status).toBe(400);
    expect(invalidTypeResponse.body.message).toBe('仅支持 PNG、JPG、JPEG、WEBP、GIF、SVG 图片');

    const oversizedResponse = await api
      .post('/api/uploads/image')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .attach('image', Buffer.alloc(config.maxUploadSizeBytes + 1, 1), {
        filename: 'big.png',
        contentType: 'image/png',
      });

    expect(oversizedResponse.status).toBe(400);
    expect(oversizedResponse.body.message).toBe(`图片大小不能超过 ${config.maxUploadSizeMb}MB`);
  });

  it('任务创建会扣减积分，并阻止其他客户越权访问', async () => {
    const adminToken = await login('admin@fashionai.local', 'Admin123!');
    const owner = await registerCustomer(makeEmail('owner'));
    const stranger = await registerCustomer(makeEmail('stranger'));

    await rechargeCustomer(adminToken, owner.id, 20);

    const createTaskResponse = await api
      .post('/api/tasks')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('host', hostHeader)
      .send({
        clothingUrl: 'https://example.com/garment.png',
        modelConfig: sampleModelConfig,
        sceneConfig: sampleSceneConfig,
      });

    expect(createTaskResponse.status).toBe(201);
    expect(createTaskResponse.body.task.status).toBe('PENDING');

    const balanceResponse = await api
      .get('/api/credits/balance')
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(balanceResponse.status).toBe(200);
    expect(balanceResponse.body.balance).toBe(10);

    const forbiddenResponse = await api
      .get(`/api/tasks/${createTaskResponse.body.task.id}`)
      .set('Authorization', `Bearer ${stranger.accessToken}`);

    expect(forbiddenResponse.status).toBe(403);
    expect(forbiddenResponse.body.message).toBe('无权访问该任务');

    const finishedTask = await waitForTaskToFinish(owner.accessToken, createTaskResponse.body.task.id);
    expect(finishedTask.status).toBe('DONE');
    expect(finishedTask.resultUrl).toMatch(/^http:\/\/127\.0\.0\.1:3101\/uploads\/results\//);

    const historyResponse = await api
      .get('/api/records')
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.records).toHaveLength(1);

    const creditHistoryResponse = await api
      .get('/api/credits/history')
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(creditHistoryResponse.status).toBe(200);
    expect(creditHistoryResponse.body.logs.some((log: { delta: number; reason: string }) => log.delta === -10 && log.reason === 'generation_hold')).toBe(true);
  });

  it('管理员看板仅统计近 7 天趋势，并序列化相对结果地址', async () => {
    const adminToken = await login('admin@fashionai.local', 'Admin123!');
    const customer = await registerCustomer(makeEmail('dashboard'));
    const oldDate = new Date();
    oldDate.setUTCDate(oldDate.getUTCDate() - 8);

    await prisma.creditLog.create({
      data: {
        userId: customer.id,
        delta: -10,
        balanceAfter: 50,
        reason: 'generation_deduct',
      },
    });

    await prisma.generationTask.create({
      data: {
        userId: customer.id,
        status: 'DONE',
        creditCost: 10,
        clothingUrl: '/uploads/old.png',
        modelConfig: JSON.stringify(sampleModelConfig),
        sceneConfig: JSON.stringify(sampleSceneConfig),
        resultUrl: '/uploads/results/old.svg',
        createdAt: oldDate,
        finishedAt: oldDate,
      },
    });

    await prisma.generationTask.create({
      data: {
        userId: customer.id,
        status: 'DONE',
        creditCost: 10,
        clothingUrl: '/uploads/recent.png',
        modelConfig: JSON.stringify(sampleModelConfig),
        sceneConfig: JSON.stringify(sampleSceneConfig),
        resultUrl: '/uploads/results/recent.svg',
        finishedAt: new Date(),
      },
    });

    const dashboardResponse = await api
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('host', hostHeader);

    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.body.summary.taskCount).toBe(2);
    expect(dashboardResponse.body.summary.activeCustomerCount).toBe(1);
    expect(dashboardResponse.body.summary.totalCreditsConsumed).toBe(10);

    const dailyTaskTotal = dashboardResponse.body.dailyTasks.reduce(
      (sum: number, item: { count: number }) => sum + item.count,
      0,
    );

    expect(dailyTaskTotal).toBe(1);
    expect(dashboardResponse.body.topCustomers).toContainEqual({
      email: customer.email,
      spent: 10,
    });
    expect(
      dashboardResponse.body.recentTasks.some(
        (task: { resultUrl: string }) => task.resultUrl === 'http://127.0.0.1:3101/uploads/results/recent.svg',
      ),
    ).toBe(true);
  });
});
