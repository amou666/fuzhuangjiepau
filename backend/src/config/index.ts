import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toOrigins = (value: string | undefined, fallback: string[]) => {
  const origins = value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return origins?.length ? origins : fallback;
};

const generateRandomPassword = () => {
  return crypto.randomBytes(16).toString('base64').slice(0, 24);
};

const generateRandomSecret = () => {
  return crypto.randomBytes(32).toString('hex');
};

const maxUploadSizeMb = toNumber(process.env.MAX_UPLOAD_SIZE_MB, 5);

// 生成首次运行的随机密码（如果未配置环境变量）
const adminPassword = process.env.ADMIN_PASSWORD || generateRandomPassword();
const demoPassword = process.env.DEMO_PASSWORD || generateRandomPassword();

// 生成随机 JWT 密钥（如果未配置环境变量）
const jwtSecret = process.env.JWT_SECRET || generateRandomSecret();
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || generateRandomSecret();

export const config = {
  port: toNumber(process.env.PORT, 3001),
  jwtSecret,
  jwtRefreshSecret,
  isDefaultJwtSecret: !process.env.JWT_SECRET,
  frontendOrigins: toOrigins(process.env.FRONTEND_ORIGIN, [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
  ]),
  publicApiBaseUrl: process.env.PUBLIC_API_BASE_URL?.trim() || '',
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads'),
  adminEmail: process.env.ADMIN_EMAIL || 'admin@fashionai.local',
  adminPassword,
  demoEmail: process.env.DEMO_EMAIL || 'demo@fashionai.local',
  demoPassword,
  isDefaultPassword: !process.env.ADMIN_PASSWORD && !process.env.DEMO_PASSWORD,
  mockAi: process.env.MOCK_AI !== 'false',
  aiApiBaseUrl: (process.env.AI_API_BASE_URL?.trim() || 'https://api.apiyi.com/v1').replace(/\/+$/, ''),
  aiApiKey: process.env.AI_API_KEY?.trim() || '',
  aiAnalysisModel: process.env.AI_ANALYSIS_MODEL?.trim() || process.env.AI_MODEL?.trim() || 'nano-banana-2',
  aiGenerationModel: process.env.AI_GENERATION_MODEL?.trim() || process.env.AI_MODEL?.trim() || 'nano-banana-2',
  aiImageDetail: process.env.AI_IMAGE_DETAIL?.trim() || 'high',
  aiRequestTimeoutMs: toNumber(process.env.AI_REQUEST_TIMEOUT_MS, 120000),
  creditPerGeneration: toNumber(process.env.CREDIT_PER_GENERATION, 10),
  creditPerUpscale: toNumber(process.env.CREDIT_PER_UPSCALE, 5),
  maxUploadSizeMb,
  maxUploadSizeBytes: maxUploadSizeMb * 1024 * 1024,
};
