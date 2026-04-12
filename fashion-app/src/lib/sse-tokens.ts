import { v4 as uuidv4 } from 'uuid'

// SSE Token 管理（不放在 route.ts 中，因为 Next.js 不允许从 route 文件导出非 HTTP 方法）

const sseTokens = new Map<string, { userId: string; createdAt: number }>()

// 清理过期 token 的函数
function cleanupExpiredTokens() {
  const now = Date.now()
  for (const [token, data] of sseTokens) {
    if (now - data.createdAt > 5 * 60 * 1000) {
      sseTokens.delete(token)
    }
  }
}

// 使用全局变量防止热重载时创建多个定时器
const globalForSSE = globalThis as unknown as { sseCleanupTimer?: ReturnType<typeof setInterval> }

if (!globalForSSE.sseCleanupTimer) {
  globalForSSE.sseCleanupTimer = setInterval(cleanupExpiredTokens, 60 * 1000)
}

export function createSseToken(userId: string): string {
  // 每次创建 token 时顺便清理过期的
  cleanupExpiredTokens()
  const token = uuidv4()
  sseTokens.set(token, { userId, createdAt: Date.now() })
  return token
}

export function verifySseToken(token: string): string | null {
  const data = sseTokens.get(token)
  if (!data) return null
  if (Date.now() - data.createdAt > 5 * 60 * 1000) {
    sseTokens.delete(token)
    return null
  }
  return data.userId
}
