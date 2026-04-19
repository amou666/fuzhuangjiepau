import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { v4 as uuidv4 } from 'uuid'

const VALID_TYPES = ['clothing', 'model', 'scene', 'full']

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    let rows: any[]
    if (type && VALID_TYPES.includes(type)) {
      rows = db.prepare('SELECT * FROM Favorite WHERE userId = ? AND type = ? ORDER BY createdAt DESC').all(payload.userId, type)
    } else {
      rows = db.prepare('SELECT * FROM Favorite WHERE userId = ? ORDER BY createdAt DESC').all(payload.userId)
    }

    const favorites = rows.map((r: any) => {
      let data = {}
      try { data = JSON.parse(r.data || '{}') } catch { /* corrupted data fallback */ }
      return { ...r, data }
    })

    return NextResponse.json({ favorites })
  } catch (error: any) {
    console.error('[Favorites GET Error]', error)
    return NextResponse.json({ message: '获取收藏失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const body = await request.json()
    const { type, name, data, previewUrl } = body

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json({ message: `类型必须是 ${VALID_TYPES.join('/')}` }, { status: 400 })
    }
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ message: '请输入名称' }, { status: 400 })
    }
    if (!data || typeof data !== 'object') {
      return NextResponse.json({ message: '配置数据不能为空' }, { status: 400 })
    }

    const count = (db.prepare('SELECT COUNT(*) as c FROM Favorite WHERE userId = ?').get(payload.userId) as any).c
    if (count >= 100) {
      return NextResponse.json({ message: '收藏数量已达上限（100）' }, { status: 400 })
    }

    const id = uuidv4()
    db.prepare(
      'INSERT INTO Favorite (id, userId, type, name, data, previewUrl) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, payload.userId, type, name.trim(), JSON.stringify(data), previewUrl || null)

    const row = db.prepare('SELECT * FROM Favorite WHERE id = ?').get(id) as any
    let parsedData = {}
    try { parsedData = JSON.parse(row.data || '{}') } catch { /* fallback */ }
    return NextResponse.json({
      favorite: { ...row, data: parsedData },
    }, { status: 201 })
  } catch (error: any) {
    console.error('[Favorites POST Error]', error)
    return NextResponse.json({ message: '保存收藏失败' }, { status: 500 })
  }
}
