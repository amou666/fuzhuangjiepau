import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, isAuthed } from '@/lib/api-auth'

function escapeCSV(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function toCSV(headers: string[], rows: Record<string, unknown>[]): string {
  const lines = [headers.map(escapeCSV).join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCSV(row[h] as string)).join(','))
  }
  return '\ufeff' + lines.join('\n')
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'customers'

    let csv = ''
    let filename = ''

    if (type === 'customers') {
      const rows = db.prepare(
        `SELECT u.id, u.email, u.role, u.credits, u.isActive, u.createdAt,
                (SELECT COUNT(*) FROM GenerationTask WHERE userId = u.id) as taskCount,
                (SELECT COALESCE(SUM(ABS(delta)), 0) FROM CreditLog WHERE userId = u.id AND delta < 0) as totalSpent
         FROM User u ORDER BY u.createdAt DESC`
      ).all() as Record<string, unknown>[]
      csv = toCSV(['email', 'role', 'credits', 'isActive', 'taskCount', 'totalSpent', 'createdAt'], rows)
      filename = `customers_${new Date().toISOString().slice(0, 10)}.csv`
    } else if (type === 'tasks') {
      const rows = db.prepare(
        `SELECT t.id, u.email, t.type, t.status, t.creditCost, t.clothingDescription, t.createdAt, t.finishedAt
         FROM GenerationTask t LEFT JOIN User u ON t.userId = u.id
         ORDER BY t.createdAt DESC LIMIT 5000`
      ).all() as Record<string, unknown>[]
      csv = toCSV(['id', 'email', 'type', 'status', 'creditCost', 'clothingDescription', 'createdAt', 'finishedAt'], rows)
      filename = `tasks_${new Date().toISOString().slice(0, 10)}.csv`
    } else if (type === 'credits') {
      const rows = db.prepare(
        `SELECT c.id, u.email, c.delta, c.balanceAfter, c.reason, c.createdAt
         FROM CreditLog c LEFT JOIN User u ON c.userId = u.id
         ORDER BY c.createdAt DESC LIMIT 5000`
      ).all() as Record<string, unknown>[]
      csv = toCSV(['email', 'delta', 'balanceAfter', 'reason', 'createdAt'], rows)
      filename = `credits_${new Date().toISOString().slice(0, 10)}.csv`
    } else {
      return NextResponse.json({ message: '无效的导出类型' }, { status: 400 })
    }

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('[Admin Export Error]', error)
    return NextResponse.json({ message: '导出失败' }, { status: 500 })
  }
}
