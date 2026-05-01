import { db } from './db'
import { AIService } from './ai-service'
import { CreditService } from './credit-service'
import { queries } from './db-queries'
import type { ModelConfig, SceneConfig } from './types'
import { safeJsonParse } from './utils/json'
import { decryptApiKey } from './utils/security'
import { buildWatermarkSvg } from './watermark'
import { v4 as uuidv4 } from 'uuid'

function pushTaskNotification(userId: string, type: 'success' | 'failed', taskId: string, taskType: string) {
  try {
    const typeLabel = taskType === 'model-fusion' ? '模特合成' : taskType === 'redesign' ? 'AI 改款' : taskType === 'quick-workspace' ? '快速工作台' : '生图'
    const title = type === 'success' ? `${typeLabel}任务完成` : `${typeLabel}任务失败`
    const content = type === 'success'
      ? `你的${typeLabel}任务已完成，前往历史记录查看结果。`
      : `你的${typeLabel}任务处理失败，积分已自动退还。`
    db.prepare(
      'INSERT INTO Notification (id, userId, type, title, content) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), userId, type === 'success' ? 'system' : 'system', title, content)
  } catch (err) {
    console.error('Failed to push task notification:', err)
  }
}

export async function processGenerationTask(taskId: string) {
  try {
    const task = queries.task.findById(taskId)
    if (!task) return

    // 获取用户的 AI API Key
    const apiKey = queries.user.findApiKey(task.userId)
    const userApiKey = apiKey ? decryptApiKey(apiKey) : undefined

    // 更新状态：处理中
    db.prepare("UPDATE GenerationTask SET status = ?, updatedAt = datetime('now') WHERE id = ?").run('PROCESSING', taskId)

    const modelConfig: ModelConfig = safeJsonParse(task.modelConfig, {}) as ModelConfig
    const sceneConfig: SceneConfig = safeJsonParse(task.sceneConfig, {}) as SceneConfig
    const clothingDetailUrls: string[] = safeJsonParse(task.clothingDetailUrls, []) as string[]
    const ai = new AIService()

    // 快速工作台：串行执行「分析布局 → 合成」
    if (task.type === 'quick-workspace') {
      const quickMode: 'background' | 'fusion' = sceneConfig.quickMode === 'fusion' ? 'fusion' : 'background'
      const sceneImageUrl = sceneConfig.imageUrl || ''
      const modelImageUrl = modelConfig.imageUrl || ''
      if (!sceneImageUrl) throw new Error('缺少场景图片')
      // 背景模式下模特图必填，融合模式下可选
      if (quickMode === 'background' && !modelImageUrl) throw new Error('缺少模特图片')

      const quickFraming: 'auto' | 'half' | 'full' = sceneConfig.quickFraming === 'full' || sceneConfig.quickFraming === 'half' ? sceneConfig.quickFraming : 'auto'
      const quickAspect = sceneConfig.aspectRatio || '3:4'
      const quickDevice: string = typeof sceneConfig.quickDevice === 'string' && sceneConfig.quickDevice !== 'auto' ? sceneConfig.quickDevice : 'phone'

      // 简化 prompt 后不再需要前置布局分析，直接进入合成，节省一次 AI 请求 + 延迟
      db.prepare("UPDATE GenerationTask SET status = ?, updatedAt = datetime('now') WHERE id = ?").run('GENERATING', taskId)
      const resultUrl = await ai.generateQuickWorkspaceImage(taskId, {
        mode: quickMode,
        clothingUrl: task.clothingUrl,
        clothingBackUrl: task.clothingBackUrl || undefined,
        modelImageUrl,
        sceneImageUrl,
        extraPrompt: sceneConfig.prompt || undefined,
        aspectRatio: quickAspect,
        framing: quickFraming,
        device: quickDevice,
        batchVariation: sceneConfig.batchVariation || undefined,
      }, userApiKey)

      db.prepare(
        "UPDATE GenerationTask SET status = ?, resultUrl = ?, finishedAt = datetime('now'), updatedAt = datetime('now') WHERE id = ?"
      ).run('COMPLETED', resultUrl, taskId)

      pushTaskNotification(task.userId, 'success', taskId, 'quick-workspace')
      console.log(`✅ Quick-workspace task ${taskId} completed`)
      return
    }

    // Step 1: 服装不调用AI接口，直接由 generateResultImage 参考原图
    const clothingDesc = ''

    // Step 2: 描述模特
    db.prepare("UPDATE GenerationTask SET status = ?, updatedAt = datetime('now') WHERE id = ?").run('DESCRIBING_MODEL', taskId)
    const modelDesc = await ai.describeModel(task.clothingUrl, modelConfig, sceneConfig.mode, userApiKey)

    // Step 3: 描述场景
    db.prepare("UPDATE GenerationTask SET status = ?, updatedAt = datetime('now') WHERE id = ?").run('DESCRIBING_SCENE', taskId)
    const sceneDesc = await ai.describeScene(sceneConfig, userApiKey)

    // Step 4: 构建融合 prompt
    const prompt = ai.buildStreetFashionPrompt(clothingDesc, modelDesc, sceneDesc, modelConfig, sceneConfig)

    // Step 5: 生成结果（替换模式且文字模特时会先自动生成面部参考肖像）
    db.prepare("UPDATE GenerationTask SET status = ?, updatedAt = datetime('now') WHERE id = ?").run('GENERATING', taskId)
    const resultUrl = await ai.generateResultImage(taskId, prompt, {
      clothingUrl: task.clothingUrl,
      clothingBackUrl: task.clothingBackUrl || undefined,
      clothingDetailUrls,
      modelConfig,
      sceneConfig,
    }, userApiKey)

    // 完成
    db.prepare(
      "UPDATE GenerationTask SET status = ?, resultUrl = ?, finishedAt = datetime('now'), updatedAt = datetime('now') WHERE id = ?"
    ).run('COMPLETED', resultUrl, taskId)

    pushTaskNotification(task.userId, 'success', taskId, task.type || 'workspace')
    console.log(`✅ Task ${taskId} completed`)
  } catch (error: any) {
    console.error(`❌ Task ${taskId} failed:`, error.message)
    db.prepare(
      "UPDATE GenerationTask SET status = ?, errorMsg = ?, updatedAt = datetime('now') WHERE id = ?"
    ).run('FAILED', error.message || '未知错误', taskId)

    // 失败退款（幂等，避免重复退款）
    try {
      const failedTask = queries.task.findMetaById(taskId)
      if (failedTask && failedTask.creditCost > 0) {
        const refundReason = `任务失败退款 (${taskId.slice(0, 8)})`
        const result = CreditService.refundCreditsOnce(failedTask.userId, failedTask.creditCost, `${taskId}:generation`, refundReason)
        if (result.refunded) {
          console.log(`💰 Refunded ${failedTask.creditCost} credits to user ${failedTask.userId}`)
        } else {
          console.log(`ℹ️ Skip duplicate refund for task ${taskId}`)
        }
      }
      if (failedTask) {
        pushTaskNotification(failedTask.userId, 'failed', taskId, failedTask.type || 'workspace')
      }
    } catch (refundError) {
      console.error(`❌ Refund failed for task ${taskId}:`, refundError)
    }
  }
}

export async function processUpscaleTask(taskId: string, imageUrl: string, factor: number, userId?: string) {
  try {
    // 获取用户的 AI API Key
    const taskMeta = queries.task.findMetaById(taskId)
    const taskUserId = userId || taskMeta?.userId
    const apiKey = taskUserId ? queries.user.findApiKey(taskUserId) : null
    const userApiKey = apiKey ? decryptApiKey(apiKey) : undefined

    const ai = new AIService()
    const upscaledUrl = await ai.upscaleImage(taskId, imageUrl, factor, userApiKey)

    db.prepare(
      "UPDATE GenerationTask SET status = ?, upscaledUrl = ?, upscaleFactor = ?, finishedAt = datetime('now'), updatedAt = datetime('now') WHERE id = ?"
    ).run('COMPLETED', upscaledUrl, factor, taskId)

    console.log(`✅ Upscale task ${taskId} completed`)
  } catch (error: any) {
    console.error(`❌ Upscale task ${taskId} failed:`, error.message)
    db.prepare(
      "UPDATE GenerationTask SET status = ?, errorMsg = ?, updatedAt = datetime('now') WHERE id = ?"
    ).run('FAILED', error.message || '放大失败', taskId)

    // 失败退款（幂等，避免重复退款）
    try {
      const taskMeta = queries.task.findMetaById(taskId)
      if (taskMeta?.userId) {
        const refundReason = `放大失败退款 (${taskId.slice(0, 8)})`
        const result = CreditService.refundCreditsOnce(taskMeta.userId, 1, `${taskId}:upscale:${factor}`, refundReason)
        if (result.refunded) {
          console.log(`💰 Refunded 1 credit to user ${taskMeta.userId} for upscale failure`)
        } else {
          console.log(`ℹ️ Skip duplicate upscale refund for task ${taskId}`)
        }
      }
    } catch (refundError) {
      console.error(`❌ Upscale refund failed for task ${taskId}:`, refundError)
    }
  }
}
