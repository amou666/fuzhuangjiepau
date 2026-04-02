import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const garmentFixturePath = path.resolve(__dirname, 'fixtures/garment.svg');

const login = async (page: Page, email: string, password: string) => {
  await page.goto('/login');
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码').fill(password);
  await page.getByRole('button', { name: '立即登录' }).click();
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
});

test('管理员可以创建客户并完成充值', async ({ page }) => {
  const customerEmail = `e2e-admin-${Date.now()}@fashionai.local`;

  await login(page, 'admin@fashionai.local', 'Admin123!');
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByRole('heading', { name: '管理员看板' })).toBeVisible();

  await page.getByRole('link', { name: '客户管理' }).click();
  await expect(page).toHaveURL(/\/admin\/customers$/);

  await page.getByLabel('邮箱').fill(customerEmail);
  await page.getByLabel('初始密码').fill('Qa123456');
  await page.getByLabel('初始积分').fill('8');
  await page.getByRole('button', { name: '创建客户' }).click();
  await expect(page.getByRole('cell', { name: customerEmail })).toBeVisible();

  await page.getByRole('link', { name: '积分管理' }).click();
  await expect(page).toHaveURL(/\/admin\/credits$/);

  const option = page.locator('#credit-customer option').filter({ hasText: customerEmail }).first();
  await expect(page.locator('#credit-customer option').filter({ hasText: customerEmail })).toHaveCount(1);
  const userId = await option.getAttribute('value');
  expect(userId).toBeTruthy();

  await page.locator('#credit-customer').selectOption(userId!);
  await page.getByLabel('充值积分').fill('6');
  await page.getByRole('button', { name: '确认充值' }).click();

  await expect(page.locator('.panel.inline-actions').filter({ hasText: customerEmail }).first()).toContainText('14 积分');
});

test('客户可以上传服装图并完成一次生成', async ({ page }) => {
  await login(page, 'demo@fashionai.local', 'Demo123!');
  await expect(page).toHaveURL(/\/app\/workspace$/);
  await expect(page.getByRole('heading', { name: '生图工作台' })).toBeVisible();

  await page.locator('.upload-box input[type="file"]').setInputFiles(garmentFixturePath);
  await expect(page.locator('img[alt="服装图片"]')).toBeVisible();

  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByRole('button', { name: '下一步' }).click();

  await page.getByRole('button', { name: /立即生成/ }).click();
  await expect(page.getByText('任务已提交，正在为你生成街拍图...')).toBeVisible();
  await expect(page.locator('.status-pill').filter({ hasText: 'DONE' })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('img[alt="生成结果"]')).toBeVisible();

  await page.getByRole('link', { name: '历史记录' }).click();
  await expect(page).toHaveURL(/\/app\/history$/);
  await expect(page.locator('img[alt="历史结果图"]').first()).toBeVisible();

  await page.getByRole('link', { name: '个人中心' }).click();
  await expect(page).toHaveURL(/\/app\/profile$/);
  await expect(page.getByRole('main').getByText('demo@fashionai.local')).toBeVisible();
});
