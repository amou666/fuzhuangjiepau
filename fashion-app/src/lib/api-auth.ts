import { NextRequest, NextResponse } from 'next/server'
import { db } from './db'
import { verifyAccessToken, type JwtPayload } from './auth'

export interface AuthResult {
  payload: JwtPayload
}

export interface AdminAuthResult extends AuthResult {
  payload: JwtPayload & { role: 'ADMIN' }
}

/**
 * Unified auth helper — extracts and verifies JWT, returns 401 on any failure.
 * Replaces the repetitive auth boilerplate across all API routes.
 */
export function requireAuth(request: NextRequest): AuthResult | NextResponse {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ message: '未授权' }, { status: 401 })
  }

  try {
    const token = authHeader.substring(7)
    const payload = verifyAccessToken(token)
    return { payload }
  } catch {
    return NextResponse.json({ message: '令牌无效或已过期' }, { status: 401 })
  }
}

/**
 * Admin-only auth — verifies JWT then double-checks DB for role & active status.
 * Prevents stale JWT from granting admin access after demotion/deactivation.
 */
export function requireAdmin(request: NextRequest): AdminAuthResult | NextResponse {
  const result = requireAuth(request)
  if (result instanceof NextResponse) return result

  const { payload } = result

  if (payload.role !== 'ADMIN') {
    return NextResponse.json({ message: '仅管理员可操作' }, { status: 403 })
  }

  const user = db.prepare('SELECT role, isActive FROM User WHERE id = ?').get(payload.userId) as
    | { role: string; isActive: number }
    | undefined

  if (!user || user.role !== 'ADMIN' || !user.isActive) {
    return NextResponse.json({ message: '管理员权限已失效，请重新登录' }, { status: 403 })
  }

  return { payload: payload as JwtPayload & { role: 'ADMIN' } }
}

/** Type guard — true when the result is a successful auth, not an error response */
export function isAuthed<T extends AuthResult>(result: T | NextResponse): result is T {
  return !(result instanceof NextResponse)
}
