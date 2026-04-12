/**
 * Simple in-memory sliding-window rate limiter.
 * Good enough for single-process deployments (SQLite-backed apps).
 * For multi-process / clustered setups, swap to Redis.
 */

interface WindowEntry {
  timestamps: number[]
}

const store = new Map<string, WindowEntry>()

const CLEANUP_INTERVAL = 60_000
let lastCleanup = Date.now()

function cleanup(windowMs: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  const cutoff = now - windowMs
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff)
    if (entry.timestamps.length === 0) store.delete(key)
  }
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs?: number
}

/**
 * Check rate limit for a given key (e.g. IP or userId).
 * @param key  - identifier (IP, userId, etc.)
 * @param max  - max requests allowed in the window
 * @param windowMs - window size in milliseconds (default 60s)
 */
export function checkRateLimit(key: string, max: number, windowMs = 60_000): RateLimitResult {
  cleanup(windowMs)

  const now = Date.now()
  const cutoff = now - windowMs
  let entry = store.get(key)

  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  entry.timestamps = entry.timestamps.filter((t) => t > cutoff)

  if (entry.timestamps.length >= max) {
    const oldest = entry.timestamps[0]
    return { allowed: false, remaining: 0, retryAfterMs: oldest + windowMs - now }
  }

  entry.timestamps.push(now)
  return { allowed: true, remaining: max - entry.timestamps.length }
}
