import crypto from 'crypto'
import path from 'path'

// 首次运行时自动生成随机密码和密钥（如果未配置环境变量）
const generateRandomPassword = () => crypto.randomBytes(16).toString('base64').slice(0, 24)
const generateRandomSecret = () => crypto.randomBytes(32).toString('hex')

const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456'
const demoPassword = process.env.DEMO_PASSWORD || generateRandomPassword()
const jwtSecret = process.env.JWT_SECRET || generateRandomSecret()
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || generateRandomSecret()

export const config = {
  port: parseInt(process.env.PORT || '3001'),
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  adminEmail: process.env.ADMIN_EMAIL || 'admin@qq.com',
  adminPassword,
  demoEmail: process.env.DEMO_EMAIL || 'demo@fashionai.local',
  demoPassword,
  isDefaultPassword: !process.env.ADMIN_PASSWORD && !process.env.DEMO_PASSWORD,
  isDefaultJwtSecret: !process.env.JWT_SECRET,
  jwtSecret,
  jwtRefreshSecret,
  aiApiUrl: process.env.AI_API_URL || 'https://api.apiyi.com/v1/chat/completions',
  aiApiBaseUrl: process.env.AI_API_URL?.replace('/chat/completions', '') || 'https://api.apiyi.com/v1',
  aiApiKey: process.env.AI_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'nano-banana-2',
  /** 参考图分辨率：high 更利还原但易「刀锐」；nano-banana 街拍可试 auto 或 low 略柔 */
  aiImageDetail: (process.env.AI_IMAGE_DETAIL || 'high') as 'low' | 'high' | 'auto',
  /** 仅部分网关支持；未配置则不发送。nano-banana 系可试 0.55–0.75 略减「过滑」 */
  aiGenerationTemperature: (() => {
    const raw = process.env.AI_GENERATION_TEMPERATURE
    if (raw === undefined || raw === '') return undefined
    const n = Number.parseFloat(raw)
    return Number.isFinite(n) ? n : undefined
  })() as number | undefined,
  aiRequestTimeoutMs: parseInt(process.env.AI_REQUEST_TIMEOUT_MS || '120000'),
  creditPerGeneration: parseInt(process.env.CREDIT_PER_GENERATION || '1'),
  creditPerUpscale: parseInt(process.env.CREDIT_PER_UPSCALE || '1'),

  publicApiBaseUrl: process.env.PUBLIC_API_BASE_URL || 'http://localhost:3001',
}

export function getUploadPath() {
  return path.resolve(process.cwd(), config.uploadDir)
}
