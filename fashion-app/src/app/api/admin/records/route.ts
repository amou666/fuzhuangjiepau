import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, isAuthed } from '@/lib/api-auth'
import { safeJsonParse } from '@/lib/utils/json'

export async function GET(request: NextRequest) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth

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
        resultUrls: safeJsonParse(r.resultUrls, []),
        user: r.userEmail ? { email: r.userEmail } : undefined,
      })),
    })
  } catch (error) {
    console.error('[Admin Records Error]', error)
    return NextResponse.json({ message: '获取记录失败' }, { status: 500 })
  }
}
