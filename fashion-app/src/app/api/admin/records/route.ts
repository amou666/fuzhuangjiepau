import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken } from '@/lib/auth'
import { safeJsonParse } from '@/lib/utils/json'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: '未授权' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const payload = verifyAccessToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ message: '仅管理员可访问' }, { status: 403 })
    }

    const records = db.prepare(`
      SELECT t.*, u.email as userEmail
      FROM GenerationTask t
      LEFT JOIN User u ON t.userId = u.id
      ORDER BY t.createdAt DESC
    `).all()

    return NextResponse.json({
      records: records.map((r: any) => ({
        ...r,
        clothingDetailUrls: safeJsonParse(r.clothingDetailUrls, []),
        modelConfig: safeJsonParse(r.modelConfig, {}),
        sceneConfig: safeJsonParse(r.sceneConfig, {}),
        user: r.userEmail ? { email: r.userEmail } : undefined,
      })),
    })
  } catch (error) {
    console.error('[Admin Records Error]', error)
    return NextResponse.json({ message: '获取记录失败' }, { status: 500 })
  }
}
