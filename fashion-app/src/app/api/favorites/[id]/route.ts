import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const { id } = await params

    const existing = db.prepare('SELECT id FROM Favorite WHERE id = ? AND userId = ?').get(id, payload.userId) as any
    if (!existing) {
      return NextResponse.json({ message: '收藏不存在' }, { status: 404 })
    }

    db.prepare('DELETE FROM Favorite WHERE id = ?').run(id)
    return NextResponse.json({ message: '已删除' })
  } catch (error: any) {
    console.error('[Favorites DELETE Error]', error)
    return NextResponse.json({ message: '删除收藏失败' }, { status: 500 })
  }
}
