import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, isAuthed } from '@/lib/api-auth'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: NextRequest) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth

    let config = db.prepare('SELECT * FROM WatermarkConfig WHERE id = ?').get('global') as any
    if (!config) {
      db.prepare(
        'INSERT INTO WatermarkConfig (id, enabled, text, position, opacity, fontSize) VALUES (?, 0, ?, ?, 0.3, 16)'
      ).run('global', '', 'bottom-right')
      config = db.prepare('SELECT * FROM WatermarkConfig WHERE id = ?').get('global') as any
    }

    return NextResponse.json({
      watermark: {
        enabled: !!config.enabled,
        text: config.text,
        position: config.position,
        opacity: config.opacity,
        fontSize: config.fontSize,
      },
    })
  } catch (error) {
    console.error('[Admin Watermark GET Error]', error)
    return NextResponse.json({ message: '获取水印配置失败' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const body = await request.json()
    const { enabled, text, position, opacity, fontSize } = body

    const existing = db.prepare('SELECT id FROM WatermarkConfig WHERE id = ?').get('global')
    if (!existing) {
      db.prepare(
        'INSERT INTO WatermarkConfig (id, enabled, text, position, opacity, fontSize) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('global', enabled ? 1 : 0, text || '', position || 'bottom-right', opacity ?? 0.3, fontSize ?? 16)
    } else {
      db.prepare(
        "UPDATE WatermarkConfig SET enabled = ?, text = ?, position = ?, opacity = ?, fontSize = ?, updatedAt = datetime('now') WHERE id = ?"
      ).run(enabled ? 1 : 0, text || '', position || 'bottom-right', opacity ?? 0.3, fontSize ?? 16, 'global')
    }

    db.prepare(
      'INSERT INTO AdminAuditLog (id, adminId, action, detail) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), payload.userId, 'update_watermark', `更新水印配置: ${enabled ? '开启' : '关闭'} "${text || ''}"`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin Watermark PUT Error]', error)
    return NextResponse.json({ message: '更新水印配置失败' }, { status: 500 })
  }
}
