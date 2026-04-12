import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, isAuthed } from '@/lib/api-auth'
import { v4 as uuidv4 } from 'uuid'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth
    const { id } = await params

    const existing = db.prepare('SELECT id FROM Template WHERE id = ?').get(id)
    if (!existing) {
      return NextResponse.json({ message: '模板不存在' }, { status: 404 })
    }

    const body = await request.json()
    const updates: string[] = []
    const values: any[] = []

    for (const [key, val] of Object.entries(body)) {
      if (key === 'name' && typeof val === 'string') { updates.push('name = ?'); values.push(val.trim()) }
      if (key === 'description' && typeof val === 'string') { updates.push('description = ?'); values.push(val) }
      if (key === 'category' && typeof val === 'string') { updates.push('category = ?'); values.push(val) }
      if (key === 'previewUrl') { updates.push('previewUrl = ?'); values.push(val || null) }
      if (key === 'clothingUrl') { updates.push('clothingUrl = ?'); values.push(val || null) }
      if (key === 'modelConfig' && typeof val === 'object') { updates.push('modelConfig = ?'); values.push(JSON.stringify(val)) }
      if (key === 'sceneConfig' && typeof val === 'object') { updates.push('sceneConfig = ?'); values.push(JSON.stringify(val)) }
      if (key === 'isActive' && typeof val === 'boolean') { updates.push('isActive = ?'); values.push(val ? 1 : 0) }
      if (key === 'sortOrder' && typeof val === 'number') { updates.push('sortOrder = ?'); values.push(val) }
    }

    if (updates.length === 0) {
      return NextResponse.json({ message: '无有效更新字段' }, { status: 400 })
    }

    updates.push("updatedAt = datetime('now')")
    db.prepare(`UPDATE Template SET ${updates.join(', ')} WHERE id = ?`).run(...values, id)

    db.prepare(
      'INSERT INTO AdminAuditLog (id, adminId, action, detail) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), payload.userId, 'update_template', `更新模板: ${id.slice(0, 8)}`)

    const template = db.prepare('SELECT * FROM Template WHERE id = ?').get(id) as any
    return NextResponse.json({
      template: {
        ...template,
        modelConfig: JSON.parse(template.modelConfig || '{}'),
        sceneConfig: JSON.parse(template.sceneConfig || '{}'),
        isActive: !!template.isActive,
      },
    })
  } catch (error) {
    console.error('[Admin Template PATCH Error]', error)
    return NextResponse.json({ message: '更新模板失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth
    const { id } = await params

    const existing = db.prepare('SELECT name FROM Template WHERE id = ?').get(id) as any
    if (!existing) {
      return NextResponse.json({ message: '模板不存在' }, { status: 404 })
    }

    db.prepare('DELETE FROM Template WHERE id = ?').run(id)

    db.prepare(
      'INSERT INTO AdminAuditLog (id, adminId, action, detail) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), payload.userId, 'delete_template', `删除模板: ${existing.name}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin Template DELETE Error]', error)
    return NextResponse.json({ message: '删除模板失败' }, { status: 500 })
  }
}
