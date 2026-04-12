import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { mergeModelConfigWithCastingNarrative } from '@/lib/model-narrative'
import { safeJsonParse } from '@/lib/utils/json'
import { CreditService } from '@/lib/credit-service'
import { v4 as uuidv4 } from 'uuid'

const MAX_BATCH_SIZE = 20

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const body = await request.json()
    const { tasks: taskPayloads } = body

    if (!Array.isArray(taskPayloads) || taskPayloads.length === 0) {
      return NextResponse.json({ message: '请提供至少一个任务' }, { status: 400 })
    }

    if (taskPayloads.length > MAX_BATCH_SIZE) {
      return NextResponse.json({ message: `单次批量最多 ${MAX_BATCH_SIZE} 个任务` }, { status: 400 })
    }

    for (const t of taskPayloads) {
      if (!t.clothingUrl || !t.modelConfig || !t.sceneConfig) {
        return NextResponse.json({ message: '每个任务必须包含 clothingUrl、modelConfig、sceneConfig' }, { status: 400 })
      }
    }

    const totalCost = taskPayloads.reduce((sum: number, t: any) => {
      const cost = Math.max(1, Math.min(20, Math.floor(Number(t.creditCost) || 1)))
      return sum + cost
    }, 0)

    const user = db.prepare('SELECT credits, apiKey FROM User WHERE id = ?').get(payload.userId) as any
    if (!user || user.credits < totalCost) {
      return NextResponse.json({ message: `积分不足，需要 ${totalCost} 积分（当前 ${user?.credits ?? 0}）` }, { status: 403 })
    }

    if (!user.apiKey) {
      return NextResponse.json({ message: '未配置 AI API Key，请联系管理员' }, { status: 403 })
    }

    const batchId = uuidv4()
    const taskIds: string[] = []

    const createdTasks = db.transaction(() => {
      const results: any[] = []

      for (const t of taskPayloads) {
        const taskId = uuidv4()
        const creditCost = Math.max(1, Math.min(20, Math.floor(Number(t.creditCost) || 1)))
        const sceneMode = t.sceneConfig.mode === 'replace' ? 'replace' : 'preset'
        const modelConfigStored = mergeModelConfigWithCastingNarrative(t.modelConfig, sceneMode)

        const newCredits = CreditService.deductCredits(payload.userId, creditCost, `批量任务 ${batchId.slice(0, 8)}`)
        if (newCredits === null) {
          throw new Error('积分扣除失败')
        }

        db.prepare(
          `INSERT INTO GenerationTask (id, userId, status, creditCost, clothingUrl, clothingBackUrl, clothingDetailUrls, clothingDescription, modelConfig, sceneConfig)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          taskId, payload.userId, 'PENDING', creditCost,
          t.clothingUrl, t.clothingBackUrl || '',
          JSON.stringify(t.clothingDetailUrls || []),
          t.clothingLength || '',
          JSON.stringify(modelConfigStored),
          JSON.stringify(t.sceneConfig),
        )

        taskIds.push(taskId)
        const row = db.prepare('SELECT * FROM GenerationTask WHERE id = ?').get(taskId) as any
        results.push({
          ...row,
          clothingDetailUrls: safeJsonParse(row.clothingDetailUrls, []),
          modelConfig: safeJsonParse(row.modelConfig, {}),
          sceneConfig: safeJsonParse(row.sceneConfig, {}),
          resultUrls: safeJsonParse(row.resultUrls, []),
        })
      }

      return results
    })()

    for (const taskId of taskIds) {
      processTask(taskId).catch(err => console.error(`[Batch Task ${taskId} Error]`, err))
    }

    return NextResponse.json({ batchId, tasks: createdTasks }, { status: 201 })
  } catch (error: any) {
    console.error('[Batch Tasks POST Error]', error)
    if (error?.message === '积分扣除失败') {
      return NextResponse.json({ message: '积分不足' }, { status: 403 })
    }
    return NextResponse.json({ message: '批量创建任务失败' }, { status: 500 })
  }
}

async function processTask(taskId: string) {
  const { processGenerationTask } = await import('@/lib/task-processor')
  await processGenerationTask(taskId)
}
