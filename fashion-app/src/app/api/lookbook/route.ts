import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { CreditService } from '@/lib/credit-service'
import { queries } from '@/lib/db-queries'
import { safeJsonParse } from '@/lib/utils/json'
import { decryptApiKey } from '@/lib/utils/security'
import type { QuickWorkspaceAspectRatio, QuickWorkspaceFraming, QuickWorkspaceMode } from '@/lib/types'
import { isValidDeviceId } from '@/lib/device-presets'
import { v4 as uuidv4 } from 'uuid'
import type { BatchVariationType } from '@/lib/components/lookbook/pose-presets'

const VALID_ASPECT: QuickWorkspaceAspectRatio[] = ['3:4', '1:1', '4:3', '16:9', '9:16']
const VALID_FRAMING: QuickWorkspaceFraming[] = ['auto', 'half', 'full']
const CREDIT_COST_PER_IMAGE = 1

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
      batchVariation,
      poseHints,
      count,
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
      batchVariation?: BatchVariationType
      poseHints?: string[]
      count?: number
    }

    if (!clothingUrl || !sceneImageUrl) {
      return NextResponse.json({ message: '请上传衣服正面和场景图' }, { status: 400 })
    }
    const quickMode: QuickWorkspaceMode = mode === 'fusion' ? 'fusion' : 'background'
    // 背景模式下模特图为必填
    if (quickMode === 'background' && !modelImageUrl) {
      return NextResponse.json({ message: '背景图模式下请上传模特图' }, { status: 400 })
    }

    const finalCount = Math.min(Math.max(count || 3, 1), 8)
    const finalBatchVariation: BatchVariationType = (batchVariation && ['pose', 'scene', 'both'].includes(batchVariation) ? batchVariation : 'pose') as BatchVariationType
    const finalPoseHints: string[] = Array.isArray(poseHints) ? poseHints.filter((h): h is string => Boolean(h)) : []

    const finalAspect: QuickWorkspaceAspectRatio = aspectRatio && VALID_ASPECT.includes(aspectRatio) ? aspectRatio : '3:4'
    const finalFraming: QuickWorkspaceFraming = framing && VALID_FRAMING.includes(framing) ? framing : 'auto'
    const finalDevice: string = isValidDeviceId(device) ? device : 'phone'

    // 检查积分是否足够
    const userInfo = queries.user.findCreditsAndApiKey(payload.userId)
    if (!userInfo || userInfo.credits < finalCount * CREDIT_COST_PER_IMAGE) {
      return NextResponse.json({ message: `积分不足，套图生成需要 ${finalCount} 积分，当前余额 ${userInfo?.credits || 0}` }, { status: 403 })
    }
    const userApiKey = userInfo.apiKey ? decryptApiKey(userInfo.apiKey) : undefined
    if (!userApiKey) {
      return NextResponse.json({ message: '未配置 AI API Key，请联系管理员' }, { status: 403 })
    }

    // 构造 N 个任务，每个带不同的 poseHint
    const taskIds: string[] = []
    const baseExtraPrompt = extraPrompt?.trim() || ''

    const created = db.transaction(() => {
      for (let i = 0; i < finalCount; i++) {
        const taskId = uuidv4()

        // 为每个任务组合 extraPrompt：原始 + poseHint
        const poseHint = finalPoseHints[i] || ''
        const combinedExtraPrompt = [baseExtraPrompt, poseHint ? `Pose requirement: ${poseHint}` : ''].filter(Boolean).join('. ')

        const modelConfig = {
          mode: 'upload' as const,
          imageUrl: modelImageUrl || '',
        }
        const sceneConfig = {
          mode: 'preset',
          sceneSource: 'upload',
          preset: '',
          imageUrl: sceneImageUrl,
          prompt: combinedExtraPrompt,
          quickMode,
          aspectRatio: finalAspect,
          quickFraming: finalFraming,
          quickDevice: finalDevice,
          batchVariation: finalBatchVariation,
          batchIndex: i + 1,
          batchTotal: finalCount,
        }

        const newCredits = CreditService.deductCredits(payload.userId, CREDIT_COST_PER_IMAGE, `套图生成 (${i + 1}/${finalCount})`)
        if (newCredits === null) {
          // 积分不足，中断事务（前面已检查，正常不会走到这里）
          return null
        }

        db.prepare(
          `INSERT INTO GenerationTask (id, userId, status, type, creditCost, clothingUrl, clothingBackUrl, clothingDetailUrls, modelConfig, sceneConfig)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          taskId,
          payload.userId,
          'PENDING',
          'quick-workspace',
          CREDIT_COST_PER_IMAGE,
          clothingUrl,
          clothingBackUrl || '',
          '[]',
          JSON.stringify(modelConfig),
          JSON.stringify(sceneConfig),
        )
        taskIds.push(taskId)
      }
      return taskIds
    })()

    if (!created) {
      return NextResponse.json({ message: '积分不足，套图生成失败' }, { status: 403 })
    }

    // 逐个启动后台处理
    for (const taskId of taskIds) {
      processTask(taskId).catch((err) => console.error('[LookBook Process Error]', err))
    }

    return NextResponse.json(
      {
        taskIds,
        count: taskIds.length,
        creditCost: taskIds.length * CREDIT_COST_PER_IMAGE,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('[LookBook POST Error]', error)
    return NextResponse.json({ message: '创建套图任务失败' }, { status: 500 })
  }
}

async function processTask(taskId: string) {
  const { processGenerationTask } = await import('@/lib/task-processor')
  await processGenerationTask(taskId)
}
