import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'

/** GET /api/pose-presets — 前端获取所有启用的姿势预设（按分类分组） */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (!isAuthed(auth)) return auth
  try {
    const rows = db.prepare(
      'SELECT * FROM PosePreset WHERE isActive = 1 ORDER BY category, sortOrder ASC'
    ).all() as Array<Record<string, any>>

    // 按分类分组
    const categories: Record<string, { id: string; label: string; desc: string; poses: any[] }> = {
      daily: { id: 'daily', label: '日常', desc: '通用日常动作', poses: [] },
      beach: { id: 'beach', label: '海边', desc: '沙滩海风经典动作', poses: [] },
      street: { id: 'street', label: '街拍', desc: '街头时尚经典动作', poses: [] },
      studio: { id: 'studio', label: '棚拍', desc: '影棚专业经典动作', poses: [] },
    }

    for (const row of rows) {
      const cat = categories[row.category]
      if (cat) {
        cat.poses.push({
          id: row.id,
          category: row.category,
          label: row.label,
          prompt: row.prompt,
          thumbnailUrl: row.thumbnailUrl || null,
          sortOrder: row.sortOrder,
        })
      }
    }

    return NextResponse.json({
      categories: Object.values(categories),
    })
  } catch (error) {
    console.error('[PosePresets GET Error]', error)
    return NextResponse.json({ message: '获取姿势预设失败' }, { status: 500 })
  }
}
