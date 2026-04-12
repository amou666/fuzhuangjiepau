import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { mergeModelConfigWithCastingNarrative } from '@/lib/model-narrative'
import { safeJsonParse } from '@/lib/utils/json'
import { CreditService } from '@/lib/credit-service'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10') || 10))
    const status = searchParams.get('status') || undefined
    const offset = (page - 1) * limit

    let whereClause = 'WHERE userId = ?'
    const params: any[] = [payload.userId]

    if (status) {
      whereClause += ' AND status = ?'
      params.push(status)
    }

    const total = (db.prepare(`SELECT COUNT(*) as count FROM GenerationTask ${whereClause}`).get(...params) as any).count
    const tasks = db.prepare(
      `SELECT * FROM GenerationTask ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset)

    return NextResponse.json({
      tasks: tasks.map((t: any) => ({
        ...t,
        clothingDetailUrls: safeJsonParse(t.clothingDetailUrls, []),
        modelConfig: safeJsonParse(t.modelConfig, {}),
        sceneConfig: safeJsonParse(t.sceneConfig, {}),
        resultUrls: safeJsonParse(t.resultUrls, []),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('[Tasks GET Error]', error)
    return NextResponse.json({ message: '获取任务列表失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const body = await request.json()
    const { clothingUrl, clothingBackUrl, clothingDetailUrls, clothingLength, modelConfig, sceneConfig, creditCost: rawCreditCost } = body
    const creditCost = Math.max(1, Math.min(20, Math.floor(Number(rawCreditCost) || 1)))

    if (!clothingUrl || !modelConfig || !sceneConfig) {
      return NextResponse.json({ message: '缺少必要参数' }, { status: 400 })
    }

    const sceneMode = sceneConfig.mode === 'replace' ? 'replace' : 'preset'
    const modelConfigStored = mergeModelConfigWithCastingNarrative(modelConfig, sceneMode)

    // 检查积分
    const user = db.prepare('SELECT credits, apiKey FROM User WHERE id = ?').get(payload.userId) as any
    if (!user || user.credits < creditCost) {
      return NextResponse.json({ message: '积分不足，请联系管理员充值' }, { status: 403 })
    }

    // 检查 AI API Key
    if (!user.apiKey) {
      return NextResponse.json({ message: '未配置 AI API Key，请联系管理员' }, { status: 403 })
    }

    // 扣积分 + 创建任务
    const taskId = uuidv4()
    const result = db.transaction(() => {
      const newCredits = CreditService.deductCredits(payload.userId, creditCost, '创建生成任务')
      if (newCredits === null) {
        return null
      }

      db.prepare(
        `INSERT INTO GenerationTask (id, userId, status, creditCost, clothingUrl, clothingBackUrl, clothingDetailUrls, clothingDescription, modelConfig, sceneConfig)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(taskId, payload.userId, 'PENDING', creditCost, clothingUrl, clothingBackUrl || '', JSON.stringify(clothingDetailUrls || []), clothingLength || '', JSON.stringify(modelConfigStored), JSON.stringify(sceneConfig))

      return taskId
    })()

    if (!result) {
      return NextResponse.json({ message: '积分不足，请联系管理员充值' }, { status: 403 })
    }

    const task = db.prepare('SELECT * FROM GenerationTask WHERE id = ?').get(taskId) as any

    // 触发异步处理（不等待）
    processTask(taskId).catch(err => console.error('[Task Process Error]', err))

    return NextResponse.json({
      task: {
        ...task,
        clothingDetailUrls: safeJsonParse(task.clothingDetailUrls, []),
        modelConfig: safeJsonParse(task.modelConfig, {}),
        sceneConfig: safeJsonParse(task.sceneConfig, {}),
        resultUrls: safeJsonParse(task.resultUrls, []),
      },
    }, { status: 201 })
  } catch (error) {
    console.error('[Tasks POST Error]', error)
    return NextResponse.json({ message: '创建任务失败' }, { status: 500 })
  }
}

async function processTask(taskId: string) {
  const { processGenerationTask } = await import('@/lib/task-processor')
  await processGenerationTask(taskId)
}
