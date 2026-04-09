import { db } from './db'
import { AIService } from './ai-service'
import type { ModelConfig, SceneConfig } from './types'
import { safeJsonParse } from './utils/json'

export async function processGenerationTask(taskId: string) {
  try {
    const task = db.prepare('SELECT * FROM GenerationTask WHERE id = ?').get(taskId) as any
    if (!task) return

    // 获取用户的 AI API Key
    const user = db.prepare('SELECT apiKey FROM User WHERE id = ?').get(task.userId) as any
    const userApiKey = user?.apiKey || undefined

    // 更新状态：处理中
    db.prepare("UPDATE GenerationTask SET status = ?, updatedAt = datetime('now') WHERE id = ?").run('PROCESSING', taskId)

    const modelConfig: ModelConfig = safeJsonParse(task.modelConfig, {}) as ModelConfig
    const sceneConfig: SceneConfig = safeJsonParse(task.sceneConfig, {}) as SceneConfig
    const clothingDetailUrls: string[] = safeJsonParse(task.clothingDetailUrls, []) as string[]
    const ai = new AIService()

    // Step 1: 分析服装（clothingDescription 字段暂存了 clothingLength）
    db.prepare("UPDATE GenerationTask SET status = ?, updatedAt = datetime('now') WHERE id = ?").run('ANALYZING_CLOTHING', taskId)
    const clothingLength = task.clothingDescription || undefined
    const clothingDesc = await ai.analyzeClothing(task.clothingUrl, clothingLength as any, task.clothingBackUrl, clothingDetailUrls, userApiKey)

    // Step 2: 描述模特
    db.prepare("UPDATE GenerationTask SET status = ?, clothingDescription = ?, updatedAt = datetime('now') WHERE id = ?").run('DESCRIBING_MODEL', clothingDesc, taskId)
    const modelDesc = await ai.describeModel(task.clothingUrl, modelConfig, sceneConfig.mode, userApiKey)

    // Step 3: 描述场景
    db.prepare("UPDATE GenerationTask SET status = ?, updatedAt = datetime('now') WHERE id = ?").run('DESCRIBING_SCENE', taskId)
    const sceneDesc = await ai.describeScene(sceneConfig, userApiKey)

    // Step 4: 构建融合 prompt
    const prompt = ai.buildStreetFashionPrompt(clothingDesc, modelDesc, sceneDesc, modelConfig, sceneConfig)

    // Step 5: 生成结果
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
  }
}

export async function processUpscaleTask(taskId: string, imageUrl: string, factor: number) {
  try {
    // 获取用户的 AI API Key
    const task = db.prepare('SELECT userId FROM GenerationTask WHERE id = ?').get(taskId) as any
    const user = task ? db.prepare('SELECT apiKey FROM User WHERE id = ?').get(task.userId) as any : null
    const userApiKey = user?.apiKey || undefined

    const ai = new AIService()
    const upscaledUrl = await ai.upscaleImage(taskId, imageUrl, factor, userApiKey)

    db.prepare(
      "UPDATE GenerationTask SET upscaledUrl = ?, upscaleFactor = ?, finishedAt = datetime('now'), updatedAt = datetime('now') WHERE id = ?"
    ).run(upscaledUrl, factor, taskId)

    console.log(`✅ Upscale task ${taskId} completed`)
  } catch (error: any) {
    console.error(`❌ Upscale task ${taskId} failed:`, error.message)
    db.prepare(
      "UPDATE GenerationTask SET errorMsg = ?, updatedAt = datetime('now') WHERE id = ?"
    ).run(error.message || '放大失败', taskId)
  }
}
