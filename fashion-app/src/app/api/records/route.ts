import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { safeJsonParse } from '@/lib/utils/json'

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const records = db.prepare(`
      SELECT * FROM GenerationTask
      WHERE userId = ?
      ORDER BY createdAt DESC
    `).all(payload.userId)

    return NextResponse.json({
      records: records.map((r: any) => ({
        ...r,
        clothingDetailUrls: safeJsonParse(r.clothingDetailUrls, []),
        modelConfig: safeJsonParse(r.modelConfig, {}),
        sceneConfig: safeJsonParse(r.sceneConfig, {}),
        resultUrls: safeJsonParse(r.resultUrls, []),
      })),
    })
  } catch (error) {
    console.error('[Records Error]', error)
    return NextResponse.json({ message: '获取记录失败' }, { status: 500 })
  }
}
