import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db'
import { config } from '@/lib/config'
import { requireAdmin, isAuthed } from '@/lib/api-auth'
import { getSystemConfig, updateSystemConfig } from '@/lib/system-config'

const MAX_MODEL_NAME_LENGTH = 128
const MODEL_NAME_PATTERN = /^[A-Za-z0-9._:\-\/]+$/

export async function GET(request: NextRequest) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth

    const sc = getSystemConfig()
    return NextResponse.json({
      systemConfig: {
        aiModel: sc.aiModel,
        defaultAiModel: config.aiModel,
      },
    })
  } catch (error) {
    console.error('[Admin SystemConfig GET Error]', error)
    return NextResponse.json({ message: '获取系统配置失败' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const body = await request.json().catch(() => ({}))
    const raw = typeof body?.aiModel === 'string' ? body.aiModel.trim() : ''

    if (raw.length > MAX_MODEL_NAME_LENGTH) {
      return NextResponse.json({ message: '模型名称过长' }, { status: 400 })
    }
    if (raw && !MODEL_NAME_PATTERN.test(raw)) {
      return NextResponse.json(
        { message: '模型名称只能包含字母、数字和 . _ : - / 字符' },
        { status: 400 }
      )
    }

    const next = updateSystemConfig({ aiModel: raw })

    db.prepare(
      'INSERT INTO AdminAuditLog (id, adminId, action, detail) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), payload.userId, 'update_ai_model', `AI 模型改为: ${raw || '(默认)'}`)

    return NextResponse.json({
      success: true,
      systemConfig: {
        aiModel: next.aiModel,
        defaultAiModel: config.aiModel,
      },
    })
  } catch (error) {
    console.error('[Admin SystemConfig PUT Error]', error)
    return NextResponse.json({ message: '更新系统配置失败' }, { status: 500 })
  }
}
