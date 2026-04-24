import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db'
import { config } from '@/lib/config'
import { requireAdmin, isAuthed } from '@/lib/api-auth'
import { getSystemConfig, updateSystemConfig } from '@/lib/system-config'

const MAX_MODEL_NAME_LENGTH = 128
const MODEL_NAME_PATTERN = /^[A-Za-z0-9._:\-\/]+$/

function validateModelName(value: unknown): { ok: true; value: string } | { ok: false; message: string } {
  if (typeof value !== 'string') return { ok: false, message: '模型名称格式错误' }
  const trimmed = value.trim()
  if (trimmed.length > MAX_MODEL_NAME_LENGTH) return { ok: false, message: '模型名称过长' }
  if (trimmed && !MODEL_NAME_PATTERN.test(trimmed)) {
    return { ok: false, message: '模型名称只能包含字母、数字和 . _ : - / 字符' }
  }
  return { ok: true, value: trimmed }
}

function buildResponsePayload(sc: { aiModel: string; analysisModel: string }) {
  return {
    aiModel: sc.aiModel,
    defaultAiModel: config.aiModel,
    analysisModel: sc.analysisModel,
    defaultAnalysisModel: config.analysisModel,
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth

    const sc = getSystemConfig()
    return NextResponse.json({ systemConfig: buildResponsePayload(sc) })
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
    const partial: { aiModel?: string; analysisModel?: string } = {}
    const logParts: string[] = []

    if ('aiModel' in (body ?? {})) {
      const v = validateModelName(body.aiModel)
      if (!v.ok) return NextResponse.json({ message: v.message }, { status: 400 })
      partial.aiModel = v.value
      logParts.push(`生图模型: ${v.value || '(默认)'}`)
    }
    if ('analysisModel' in (body ?? {})) {
      const v = validateModelName(body.analysisModel)
      if (!v.ok) return NextResponse.json({ message: v.message }, { status: 400 })
      partial.analysisModel = v.value
      logParts.push(`分析模型: ${v.value || '(默认)'}`)
    }

    if (Object.keys(partial).length === 0) {
      return NextResponse.json({ message: '至少需要指定一个可更新的字段' }, { status: 400 })
    }

    const next = updateSystemConfig(partial)

    db.prepare(
      'INSERT INTO AdminAuditLog (id, adminId, action, detail) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), payload.userId, 'update_system_models', logParts.join(' | '))

    return NextResponse.json({ success: true, systemConfig: buildResponsePayload(next) })
  } catch (error) {
    console.error('[Admin SystemConfig PUT Error]', error)
    return NextResponse.json({ message: '更新系统配置失败' }, { status: 500 })
  }
}
