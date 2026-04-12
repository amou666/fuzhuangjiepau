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
    let payload
    try {
      payload = verifyAccessToken(token)
    } catch {
      return NextResponse.json({ message: '令牌已过期，请重新登录' }, { status: 401 })
    }
    if (!payload) {
      return NextResponse.json({ message: '令牌无效' }, { status: 401 })
    }

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
