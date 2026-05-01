import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { safeJsonParse } from '@/lib/utils/json'
import type { GenerationTaskRow } from '@/lib/types'

const findRecordsByUserId = db.prepare<[string], GenerationTaskRow>(`
  SELECT id, userId, status, type, creditCost, clothingUrl, clothingBackUrl, clothingDetailUrls, clothingDescription, modelConfig, sceneConfig, resultUrl, resultUrls, upscaledUrl, upscaleFactor, errorMsg, createdAt, updatedAt, finishedAt
  FROM GenerationTask
  WHERE userId = ?
  ORDER BY createdAt DESC
`)

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const records = findRecordsByUserId.all(payload.userId)

    return NextResponse.json({
      records: records.map((r) => ({
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
