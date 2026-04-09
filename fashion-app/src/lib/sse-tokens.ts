import { v4 as uuidv4 } from 'uuid'

// SSE Token 管理（不放在 route.ts 中，因为 Next.js 不允许从 route 文件导出非 HTTP 方法）

const sseTokens = new Map<string, { userId: string; createdAt: number }>()

// 每5分钟清理过期 token
setInterval(() => {
  const now = Date.now()
  for (const [token, data] of sseTokens) {
    if (now - data.createdAt > 5 * 60 * 1000) {
      sseTokens.delete(token)
    }
  }
}, 60 * 1000)

export function createSseToken(userId: string): string {
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
