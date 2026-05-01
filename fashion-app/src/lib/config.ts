import crypto from 'crypto'
import path from 'path'

// 首次运行时自动生成随机密码和密钥（如果未配置环境变量）
const generateRandomPassword = () => crypto.randomBytes(16).toString('base64').slice(0, 24)
const generateRandomSecret = () => crypto.randomBytes(32).toString('hex')

const DEFAULT_ADMIN_PASSWORD = 'admin123456'
const MIN_JWT_SECRET_LENGTH = 32

const adminPassword = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD
const demoPassword = process.env.DEMO_PASSWORD || generateRandomPassword()
const jwtSecret = process.env.JWT_SECRET || generateRandomSecret()
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || generateRandomSecret()

export const config = {
  port: parseInt(process.env.PORT || '3001'),
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB
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
  /** 生图模型：用于所有图像合成、改款、变色、放大等会输出图片的调用 */
  aiModel: process.env.AI_MODEL || 'gpt-image-2-all',
  /** 分析模型：用于图像/文字分析（服装识别、材质 DNA、脑暴方向等文本输出） */
  analysisModel: process.env.ANALYSIS_MODEL || 'nano-banana-2',
  /** 参考图分辨率：high 更利还原但易「刀锐」；街拍风格可试 auto 或 low 略柔 */
  aiImageDetail: (process.env.AI_IMAGE_DETAIL || 'high') as 'low' | 'high' | 'auto',
  /** 仅部分网关支持；未配置则不发送。可在 0.55–0.75 之间微调以略减「过滑」 */
  aiGenerationTemperature: (() => {
    const raw = process.env.AI_GENERATION_TEMPERATURE
    if (raw === undefined || raw === '') return undefined
    const n = Number.parseFloat(raw)
    return Number.isFinite(n) ? n : undefined
  })() as number | undefined,
  aiRequestTimeoutMs: parseInt(process.env.AI_REQUEST_TIMEOUT_MS || '200000'),
  creditPerGeneration: parseInt(process.env.CREDIT_PER_GENERATION || '1'),
  creditPerUpscale: parseInt(process.env.CREDIT_PER_UPSCALE || '1'),

  publicApiBaseUrl: process.env.PUBLIC_API_BASE_URL || 'http://localhost:3001',

  allowRegister: process.env.ALLOW_REGISTER !== 'false',
}

export function getUploadPath() {
  return path.resolve(process.cwd(), config.uploadDir)
}

// ─── 生产环境安全检查 ───
if (process.env.NODE_ENV === 'production') {
  const errors: string[] = []

  if (!process.env.JWT_SECRET) {
    errors.push('JWT_SECRET 未设置，使用随机密钥。服务重启后所有登录态将失效！')
  } else if (process.env.JWT_SECRET.length < MIN_JWT_SECRET_LENGTH) {
    errors.push(`JWT_SECRET 长度不足 ${MIN_JWT_SECRET_LENGTH} 字符，存在被暴力破解风险！`)
  }

  if (!process.env.JWT_REFRESH_SECRET) {
    errors.push('JWT_REFRESH_SECRET 未设置，使用随机密钥。服务重启后 refresh token 将失效！')
  } else if (process.env.JWT_REFRESH_SECRET.length < MIN_JWT_SECRET_LENGTH) {
    errors.push(`JWT_REFRESH_SECRET 长度不足 ${MIN_JWT_SECRET_LENGTH} 字符，存在被暴力破解风险！`)
  }

  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === DEFAULT_ADMIN_PASSWORD) {
    errors.push(`ADMIN_PASSWORD 使用默认值 "${DEFAULT_ADMIN_PASSWORD}"，存在严重安全风险！请立即修改。`)
  }

  if (!process.env.AI_API_KEY) {
    errors.push('AI_API_KEY 未设置，AI 生图功能将不可用。')
  }

  if (errors.length > 0) {
    console.error('\n⛔ ── 生产环境安全检查失败 ──')
    errors.forEach((msg, i) => console.error(`  ${i + 1}. ${msg}`))
    console.error('请在 .env.local 中配置以上环境变量后重启服务。\n')

    // 强密码和密钥问题直接拒绝启动
    if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === DEFAULT_ADMIN_PASSWORD ||
        (process.env.JWT_SECRET && process.env.JWT_SECRET.length < MIN_JWT_SECRET_LENGTH)) {
      console.error('❌ 因存在严重安全隐患，服务拒绝启动。请修复上述问题后重试。\n')
      process.exit(1)
    }
  }
}
