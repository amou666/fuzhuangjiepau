/**
 * 安全的 JSON 解析，解析失败时返回 fallback 而不抛异常
 */
export function safeJsonParse<T = unknown>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}
