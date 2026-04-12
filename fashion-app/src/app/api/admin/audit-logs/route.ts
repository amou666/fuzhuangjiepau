import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, isAuthed } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth

    const logs = db.prepare(`
      SELECT al.*, au.email as adminEmail, tu.email as targetEmail
      FROM AdminAuditLog al
      LEFT JOIN User au ON al.adminId = au.id
      LEFT JOIN User tu ON al.targetUserId = tu.id
      ORDER BY al.createdAt DESC
      LIMIT 100
    `).all()

    return NextResponse.json({
      logs: logs.map((l: any) => ({
        ...l,
        admin: { email: l.adminEmail || '-' },
        targetUser: l.targetEmail ? { email: l.targetEmail } : null,
      })),
    })
  } catch (error) {
    console.error('[Admin Audit Logs Error]', error)
    return NextResponse.json({ message: '获取审计日志失败' }, { status: 500 })
  }
}
