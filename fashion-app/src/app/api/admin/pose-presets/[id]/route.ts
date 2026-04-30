import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, isAuthed } from '@/lib/api-auth'
import { v4 as uuidv4 } from 'uuid'

/** PATCH /api/admin/pose-presets/[id] — 更新姿势预设 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth
    const { id } = await params

    const existing = db.prepare('SELECT id FROM PosePreset WHERE id = ?').get(id)
    if (!existing) {
      return NextResponse.json({ message: '姿势预设不存在' }, { status: 404 })
    }

    const body = await request.json()
    const updates: string[] = []
    const values: any[] = []

    for (const [key, val] of Object.entries(body)) {
      if (key === 'category' && typeof val === 'string') { updates.push('category = ?'); values.push(val.trim()) }
      if (key === 'label' && typeof val === 'string') { updates.push('label = ?'); values.push(val.trim()) }
      if (key === 'prompt' && typeof val === 'string') { updates.push('prompt = ?'); values.push(val) }
      if (key === 'thumbnailUrl') { updates.push('thumbnailUrl = ?'); values.push(val || null) }
      if (key === 'sortOrder' && typeof val === 'number') { updates.push('sortOrder = ?'); values.push(val) }
      if (key === 'isActive' && typeof val === 'boolean') { updates.push('isActive = ?'); values.push(val ? 1 : 0) }
    }

    if (updates.length === 0) {
      return NextResponse.json({ message: '无有效更新字段' }, { status: 400 })
    }

    updates.push("updatedAt = datetime('now')")
    db.prepare(`UPDATE PosePreset SET ${updates.join(', ')} WHERE id = ?`).run(...values, id)

    db.prepare(
      'INSERT INTO AdminAuditLog (id, adminId, action, detail) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), payload.userId, 'update_pose_preset', `更新姿势预设: ${id.slice(0, 8)}`)

    const row = db.prepare('SELECT * FROM PosePreset WHERE id = ?').get(id) as any
    return NextResponse.json({ posePreset: { ...row, isActive: !!row.isActive } })
  } catch (error) {
    console.error('[Admin PosePreset PATCH Error]', error)
    return NextResponse.json({ message: '更新姿势预设失败' }, { status: 500 })
  }
}

/** DELETE /api/admin/pose-presets/[id] — 删除姿势预设 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth
    const { id } = await params

    const existing = db.prepare('SELECT label FROM PosePreset WHERE id = ?').get(id) as any
    if (!existing) {
      return NextResponse.json({ message: '姿势预设不存在' }, { status: 404 })
    }

    db.prepare('DELETE FROM PosePreset WHERE id = ?').run(id)

    db.prepare(
      'INSERT INTO AdminAuditLog (id, adminId, action, detail) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), payload.userId, 'delete_pose_preset', `删除姿势预设: ${existing.label}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin PosePreset DELETE Error]', error)
    return NextResponse.json({ message: '删除姿势预设失败' }, { status: 500 })
  }
}
