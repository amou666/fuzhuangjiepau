import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '../backend');

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node -e "const fs = require(\'node:fs\'); [\'prisma/e2e.db\', \'prisma/e2e.db-journal\'].forEach((file) => fs.rmSync(file, { force: true }));" && npx prisma db push --skip-generate && npx tsx src/app.ts',
      cwd: backendDir,
      env: {
        ...process.env,
        PORT: '3002',
        DATABASE_URL: 'file:./e2e.db',
        FRONTEND_ORIGIN: 'http://127.0.0.1:4173',
        PUBLIC_API_BASE_URL: 'http://127.0.0.1:3002',
        UPLOAD_DIR: 'uploads-e2e',
        MOCK_AI: 'true',
      },
      url: 'http://127.0.0.1:3002/api/health',
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4173',
      cwd: __dirname,
      env: {
        ...process.env,
        VITE_API_BASE_URL: 'http://127.0.0.1:3002/api',
      },
      url: 'http://127.0.0.1:4173',
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
