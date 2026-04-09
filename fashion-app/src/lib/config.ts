import path from 'path'

export const config = {
  port: parseInt(process.env.PORT || '3001'),
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  adminEmail: process.env.ADMIN_EMAIL || 'admin@fashionai.local',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123456',
  demoEmail: process.env.DEMO_EMAIL || 'demo@fashionai.local',
  demoPassword: process.env.DEMO_PASSWORD || 'demo123456',
  jwtSecret: process.env.JWT_SECRET || 'fashion-ai-jwt-secret-2024-production',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'fashion-ai-refresh-secret-2024-production',
  aiApiUrl: process.env.AI_API_URL || 'https://api.apiyi.com/v1/chat/completions',
  aiApiBaseUrl: process.env.AI_API_URL?.replace('/chat/completions', '') || 'https://api.apiyi.com/v1',
  aiApiKey: process.env.AI_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'nano-banana-2',
  aiImageDetail: (process.env.AI_IMAGE_DETAIL || 'high') as 'low' | 'high' | 'auto',
  aiRequestTimeoutMs: parseInt(process.env.AI_REQUEST_TIMEOUT_MS || '120000'),


  publicApiBaseUrl: process.env.PUBLIC_API_BASE_URL || 'http://localhost:3001',
}

export function getUploadPath() {
  return path.resolve(process.cwd(), config.uploadDir)
}
