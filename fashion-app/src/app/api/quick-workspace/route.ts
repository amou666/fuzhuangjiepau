import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { CreditService } from '@/lib/credit-service'
import { safeJsonParse } from '@/lib/utils/json'
import type { QuickWorkspaceAspectRatio, QuickWorkspaceFraming, QuickWorkspaceMode } from '@/lib/types'
import { isValidDeviceId } from '@/lib/device-presets'

const VALID_ASPECT: QuickWorkspaceAspectRatio[] = ['3:4', '1:1', '4:3', '16:9', '9:16']
const VALID_FRAMING: QuickWorkspaceFraming[] = ['auto', 'half', 'full']
import { v4 as uuidv4 } from 'uuid'

const QUICK_CREDIT_COST = 1

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const body = await request.json()
    const {
      clothingUrl,
      clothingBackUrl,
      modelImageUrl,
      sceneImageUrl,
      mode,
      aspectRatio,
      framing,
      device,
      extraPrompt,
    } = body as {
      clothingUrl?: string
      clothingBackUrl?: string
      modelImageUrl?: string
      sceneImageUrl?: string
      mode?: QuickWorkspaceMode
      aspectRatio?: QuickWorkspaceAspectRatio
      framing?: QuickWorkspaceFraming
      device?: string
      extraPrompt?: string
    }

    if (!clothingUrl || !modelImageUrl || !sceneImageUrl) {
      return NextResponse.json({ message: '请上传衣服正面、模特图和场景图' }, { status: 400 })
    }
    const quickMode: QuickWorkspaceMode = mode === 'fusion' ? 'fusion' : 'background'
    const finalAspect: QuickWorkspaceAspectRatio = aspectRatio && VALID_ASPECT.includes(aspectRatio) ? aspectRatio : '3:4'
    const finalFraming: QuickWorkspaceFraming = framing && VALID_FRAMING.includes(framing) ? framing : 'auto'
    const finalDevice: string = isValidDeviceId(device) ? device : 'auto'

    const user = db.prepare('SELECT credits, apiKey FROM User WHERE id = ?').get(payload.userId) as any
    if (!user || user.credits < QUICK_CREDIT_COST) {
      return NextResponse.json({ message: '积分不足，请联系管理员充值' }, { status: 403 })
    }
    if (!user.apiKey) {
      return NextResponse.json({ message: '未配置 AI API Key，请联系管理员' }, { status: 403 })
    }

    const modelConfig = {
      mode: 'upload',
      imageUrl: modelImageUrl,
    }
    const sceneConfig = {
      mode: 'preset',
      sceneSource: 'upload',
      preset: '',
      imageUrl: sceneImageUrl,
      prompt: extraPrompt || '',
      quickMode,
      aspectRatio: finalAspect,
      quickFraming: finalFraming,
      quickDevice: finalDevice,
    }

    const taskId = uuidv4()
    const created = db.transaction(() => {
      const newCredits = CreditService.deductCredits(payload.userId, QUICK_CREDIT_COST, '快速工作台生图')
      if (newCredits === null) return null
      db.prepare(
        `INSERT INTO GenerationTask (id, userId, status, type, creditCost, clothingUrl, clothingBackUrl, clothingDetailUrls, modelConfig, sceneConfig)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        taskId,
        payload.userId,
        'PENDING',
        'quick-workspace',
        QUICK_CREDIT_COST,
        clothingUrl,
        clothingBackUrl || '',
        '[]',
        JSON.stringify(modelConfig),
        JSON.stringify(sceneConfig),
      )
      return taskId
    })()

    if (!created) {
      return NextResponse.json({ message: '积分不足，请联系管理员充值' }, { status: 403 })
    }

    const task = db.prepare('SELECT * FROM GenerationTask WHERE id = ?').get(taskId) as any

    processTask(taskId).catch((err) => console.error('[QuickWorkspace Process Error]', err))

    return NextResponse.json(
      {
        task: {
          ...task,
          clothingDetailUrls: safeJsonParse(task.clothingDetailUrls, []),
          modelConfig: safeJsonParse(task.modelConfig, {}),
          sceneConfig: safeJsonParse(task.sceneConfig, {}),
          resultUrls: safeJsonParse(task.resultUrls, []),
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('[QuickWorkspace POST Error]', error)
    return NextResponse.json({ message: '创建快速工作台任务失败' }, { status: 500 })
  }
}

async function processTask(taskId: string) {
  const { processGenerationTask } = await import('@/lib/task-processor')
  await processGenerationTask(taskId)
}
