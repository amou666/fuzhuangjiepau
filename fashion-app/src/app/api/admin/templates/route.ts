import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, isAuthed } from '@/lib/api-auth'
import { queries } from '@/lib/db-queries'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: NextRequest) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth

    const templates = queries.template.findAll()

    return NextResponse.json({
      templates: templates.map((t) => ({
        ...t,
        modelConfig: JSON.parse(t.modelConfig || '{}'),
        sceneConfig: JSON.parse(t.sceneConfig || '{}'),
        isActive: !!t.isActive,
      })),
    })
  } catch (error) {
    console.error('[Admin Templates GET Error]', error)
    return NextResponse.json({ message: '获取模板列表失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const body = await request.json()
    const { name, description, category, previewUrl, clothingUrl, modelConfig, sceneConfig } = body

    if (!name?.trim()) {
      return NextResponse.json({ message: '模板名称不能为空' }, { status: 400 })
    }

    const id = uuidv4()
    db.prepare(
      'INSERT INTO Template (id, name, description, category, previewUrl, clothingUrl, modelConfig, sceneConfig) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      id,
      name.trim(),
      description || '',
      category || 'general',
      previewUrl || null,
      clothingUrl || null,
      JSON.stringify(modelConfig || {}),
      JSON.stringify(sceneConfig || {}),
    )

    db.prepare(
      'INSERT INTO AdminAuditLog (id, adminId, action, detail) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), payload.userId, 'create_template', `创建模板: ${name.trim()}`)

    const template = queries.template.findById(id)

    return NextResponse.json({
      template: {
        ...template,
        modelConfig: JSON.parse(template?.modelConfig || '{}'),
        sceneConfig: JSON.parse(template?.sceneConfig || '{}'),
        isActive: !!template?.isActive,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('[Admin Templates POST Error]', error)
    return NextResponse.json({ message: '创建模板失败' }, { status: 500 })
  }
}
