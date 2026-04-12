import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth

    const templates = db.prepare(
      'SELECT id, name, description, category, previewUrl, clothingUrl, modelConfig, sceneConfig, createdAt FROM Template WHERE isActive = 1 ORDER BY sortOrder ASC, createdAt DESC'
    ).all()

    return NextResponse.json({
      templates: templates.map((t: any) => ({
        ...t,
        modelConfig: JSON.parse(t.modelConfig || '{}'),
        sceneConfig: JSON.parse(t.sceneConfig || '{}'),
      })),
    })
  } catch (error) {
    console.error('[Templates GET Error]', error)
    return NextResponse.json({ message: '获取模板列表失败' }, { status: 500 })
  }
}
