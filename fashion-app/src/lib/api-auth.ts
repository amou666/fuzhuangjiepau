import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken, type JwtPayload } from './auth'
import { queries } from './db-queries'

export interface AuthResult {
  payload: JwtPayload
}

export interface AdminAuthResult extends AuthResult {
  payload: JwtPayload & { role: 'ADMIN' }
}

/**
 * Unified auth helper — extracts and verifies JWT, then confirms the user
 * still exists and is active. Returns 401/403 on any failure.
 */
export function requireAuth(request: NextRequest): AuthResult | NextResponse {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ message: '未授权' }, { status: 401 })
  }

  let payload: JwtPayload
  try {
    const token = authHeader.substring(7)
    payload = verifyAccessToken(token)
  } catch {
    return NextResponse.json({ message: '令牌无效或已过期' }, { status: 401 })
  }

  // 账号级二次校验：防止禁用 / 删除账号继续使用旧 JWT
  const isActive = queries.user.findIsActive(payload.userId)

  if (isActive === undefined) {
    return NextResponse.json({ message: '账号不存在，请重新登录' }, { status: 401 })
  }
  if (!isActive) {
    return NextResponse.json({ message: '账号已被禁用' }, { status: 403 })
  }

  return { payload }
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

  // requireAuth 已经校验过 isActive，这里只补一次角色校验（role 可能在 JWT 签发后被降级）
  const role = queries.user.findRole(payload.userId)

  if (!role || role !== 'ADMIN') {
    return NextResponse.json({ message: '管理员权限已失效，请重新登录' }, { status: 403 })
  }

  return { payload: payload as JwtPayload & { role: 'ADMIN' } }
}

/** Type guard — true when the result is a successful auth, not an error response */
export function isAuthed<T extends AuthResult>(result: T | NextResponse): result is T {
  return !(result instanceof NextResponse)
}
