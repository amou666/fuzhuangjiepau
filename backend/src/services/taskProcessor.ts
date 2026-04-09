import { prisma } from '../lib/prisma';
import type { ModelConfig, SceneConfig, TaskStatus } from '../types';
import { AIService } from './aiService';
import { CreditService } from './creditService';
import { pushTaskUpdate } from './sseService';
import { config } from '../config';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 可重试的 HTTP 状态码（上游网络抖动）
const RETRYABLE_MESSAGES = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', '502', '503', '504'];

const isRetryable = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return RETRYABLE_MESSAGES.some((msg) => error.message.includes(msg));
};

/**
 * 将相对路径转换为完整URL
 */
const toFullUrl = (relativePath: string | null | undefined): string | null | undefined => {
  if (!relativePath) return relativePath;
  
  // 已经是完整URL
  if (/^https?:\/\//i.test(relativePath)) {
    return relativePath;
  }
  
  // 拼接公共API基础URL
  const baseUrl = config.publicApiBaseUrl;
  return baseUrl ? `${baseUrl}${relativePath}` : relativePath;
};

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

export const processTask = async (taskId: string, attempt = 1): Promise<void> => {
  const task = await prisma.generationTask.findUnique({ where: { id: taskId } });

  if (!task) return;

  try {
    await prisma.generationTask.update({
      where: { id: taskId },
      data: { status: 'PROCESSING' satisfies TaskStatus },
    });

    // 推送"处理中"状态给用户
    pushTaskUpdate(task.userId, { taskId, status: 'PROCESSING' });

    await wait(1200);

    const modelConfig = JSON.parse(task.modelConfig) as ModelConfig;
    const sceneConfig = JSON.parse(task.sceneConfig) as SceneConfig;
    const clothingDescription = await AIService.analyzeClothing(task.clothingUrl);
    const modelDescription = await AIService.describeModel(modelConfig);
    const sceneDescription = await AIService.describeScene(sceneConfig);
    
    // 替换模式下提取姿势描述
    let poseDescription: string | undefined;
    const isReplaceMode = sceneConfig.mode === 'replace' && sceneConfig.imageUrl;
    if (isReplaceMode && sceneConfig.imageUrl) {
      poseDescription = await AIService.describePoseFromReference(sceneConfig.imageUrl);
    }
    
    const isUploadScene = sceneConfig.sceneSource === 'upload'
    
    const prompt = AIService.buildStreetFashionPrompt(
      clothingDescription,
      modelDescription,
      sceneDescription,
      sceneConfig.depthOfField,
      sceneConfig.aspectRatio,
      poseDescription,
      isReplaceMode,
      isUploadScene,
    );
    const resultUrl = await AIService.generateResultImage(taskId, prompt, {
      clothingUrl: task.clothingUrl,
      modelConfig,
      sceneConfig,
    });

    await prisma.generationTask.update({
      where: { id: taskId },
      data: {
        status: 'DONE' satisfies TaskStatus,
        clothingDescription,
        resultUrl,
        finishedAt: new Date(),
      },
    });

    // 推送"完成"状态及结果图 URL（确保是完整URL）
    const fullResultUrl = toFullUrl(resultUrl);
    pushTaskUpdate(task.userId, { taskId, status: 'DONE', resultUrl: fullResultUrl });
  } catch (error) {
    // 可重试的网络错误且未超过最大重试次数
    if (isRetryable(error) && attempt < MAX_ATTEMPTS) {
      console.warn(`[Task ${taskId}] 第 ${attempt} 次失败，${RETRY_DELAY_MS}ms 后重试...`, error);
      // 推送重试中状态
      pushTaskUpdate(task.userId, { taskId, status: 'PROCESSING', retrying: true, attempt });
      await wait(RETRY_DELAY_MS * attempt); // 指数退避
      return processTask(taskId, attempt + 1);
    }

    const errorMsg = error instanceof Error ? error.message : '任务处理失败';

    await prisma.generationTask.update({
      where: { id: taskId },
      data: {
        status: 'FAILED' satisfies TaskStatus,
        errorMsg,
        finishedAt: new Date(),
      },
    });

    await CreditService.refundCredits(task.userId, task.creditCost);

    // 推送"失败"状态
    pushTaskUpdate(task.userId, { taskId, status: 'FAILED', errorMsg });
  }
};
