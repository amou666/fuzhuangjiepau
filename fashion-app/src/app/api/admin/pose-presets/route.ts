import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, isAuthed } from '@/lib/api-auth'
import { v4 as uuidv4 } from 'uuid'

/** GET /api/admin/pose-presets — 管理端获取所有姿势预设（含禁用的） */
export async function GET(request: NextRequest) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth

    const rows = db.prepare(
      'SELECT * FROM PosePreset ORDER BY category, sortOrder ASC'
    ).all() as Array<Record<string, any>>

    return NextResponse.json({
      posePresets: rows.map((r) => ({
        ...r,
        isActive: !!r.isActive,
      })),
    })
  } catch (error) {
    console.error('[Admin PosePresets GET Error]', error)
    return NextResponse.json({ message: '获取姿势预设失败' }, { status: 500 })
  }
}

/** POST /api/admin/pose-presets — 创建姿势预设 */
export async function POST(request: NextRequest) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const body = await request.json()
    const { category, label, prompt, thumbnailUrl, sortOrder } = body

    if (!label?.trim()) {
      return NextResponse.json({ message: '姿势名称不能为空' }, { status: 400 })
    }
    if (!category?.trim()) {
      return NextResponse.json({ message: '分类不能为空' }, { status: 400 })
    }

    const id = uuidv4()
    db.prepare(
      'INSERT INTO PosePreset (id, category, label, prompt, thumbnailUrl, sortOrder) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      id,
      category.trim(),
      label.trim(),
      prompt || '',
      thumbnailUrl || null,
      sortOrder || 0,
    )

    db.prepare(
      'INSERT INTO AdminAuditLog (id, adminId, action, detail) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), payload.userId, 'create_pose_preset', `创建姿势预设: ${label.trim()}`)

    const row = db.prepare('SELECT * FROM PosePreset WHERE id = ?').get(id) as any
    return NextResponse.json({
      posePreset: { ...row, isActive: !!row.isActive },
    }, { status: 201 })
  } catch (error) {
    console.error('[Admin PosePresets POST Error]', error)
    return NextResponse.json({ message: '创建姿势预设失败' }, { status: 500 })
  }
}
