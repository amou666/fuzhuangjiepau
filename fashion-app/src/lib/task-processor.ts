import { db } from './db'
import { AIService } from './ai-service'
import { CreditService } from './credit-service'
import type { ModelConfig, SceneConfig } from './types'
import { safeJsonParse } from './utils/json'
import { decryptApiKey } from './utils/security'

export async function processGenerationTask(taskId: string) {
  try {
    const task = db.prepare('SELECT * FROM GenerationTask WHERE id = ?').get(taskId) as any
    if (!task) return

    // 获取用户的 AI API Key
    const user = db.prepare('SELECT apiKey FROM User WHERE id = ?').get(task.userId) as any
    const userApiKey = user?.apiKey ? decryptApiKey(user.apiKey) : undefined

    // 更新状态：处理中
    db.prepare("UPDATE GenerationTask SET status = ?, updatedAt = datetime('now') WHERE id = ?").run('PROCESSING', taskId)

    const modelConfig: ModelConfig = safeJsonParse(task.modelConfig, {}) as ModelConfig
    const sceneConfig: SceneConfig = safeJsonParse(task.sceneConfig, {}) as SceneConfig
    const clothingDetailUrls: string[] = safeJsonParse(task.clothingDetailUrls, []) as string[]
    const ai = new AIService()

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

    console.log(`✅ Task ${taskId} completed`)
  } catch (error: any) {
    console.error(`❌ Task ${taskId} failed:`, error.message)
    db.prepare(
      "UPDATE GenerationTask SET status = ?, errorMsg = ?, updatedAt = datetime('now') WHERE id = ?"
    ).run('FAILED', error.message || '未知错误', taskId)

    // 失败退款（幂等，避免重复退款）
    try {
      const task = db.prepare('SELECT userId, creditCost FROM GenerationTask WHERE id = ?').get(taskId) as any
      if (task && task.creditCost > 0) {
        const refundReason = `任务失败退款 (${taskId.slice(0, 8)})`
        const result = CreditService.refundCreditsOnce(task.userId, task.creditCost, `${taskId}:generation`, refundReason)
        if (result.refunded) {
          console.log(`💰 Refunded ${task.creditCost} credits to user ${task.userId}`)
        } else {
          console.log(`ℹ️ Skip duplicate refund for task ${taskId}`)
        }
      }
    } catch (refundError) {
      console.error(`❌ Refund failed for task ${taskId}:`, refundError)
    }
  }
}

export async function processUpscaleTask(taskId: string, imageUrl: string, factor: number, userId?: string) {
  try {
    // 获取用户的 AI API Key
    const task = db.prepare('SELECT userId FROM GenerationTask WHERE id = ?').get(taskId) as any
    const taskUserId = userId || task?.userId
    const user = taskUserId ? db.prepare('SELECT apiKey FROM User WHERE id = ?').get(taskUserId) as any : null
    const userApiKey = user?.apiKey ? decryptApiKey(user.apiKey) : undefined

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
      const task = db.prepare('SELECT userId FROM GenerationTask WHERE id = ?').get(taskId) as any
      if (task?.userId) {
        const refundReason = `放大失败退款 (${taskId.slice(0, 8)})`
        const result = CreditService.refundCreditsOnce(task.userId, 1, `${taskId}:upscale:${factor}`, refundReason)
        if (result.refunded) {
          console.log(`💰 Refunded 1 credit to user ${task.userId} for upscale failure`)
        } else {
          console.log(`ℹ️ Skip duplicate upscale refund for task ${taskId}`)
        }
      }
    } catch (refundError) {
      console.error(`❌ Upscale refund failed for task ${taskId}:`, refundError)
    }
  }
}
