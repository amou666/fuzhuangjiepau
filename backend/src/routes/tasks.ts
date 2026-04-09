import { Router } from 'express';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { enqueueGenerationTask } from '../queues/generationQueue';
import { CreditService } from '../services/creditService';
import { AIService } from '../services/aiService';
import { pushTaskUpdate } from '../services/sseService';
import type { TaskPayload } from '../types';
import { serializeTask } from '../utils/taskSerializer';

const router = Router();

router.post('/', async (req, res) => {
  const body = req.body as Partial<TaskPayload>;
  const clothingUrl = body.clothingUrl?.trim();
  const hasValidConfigs = typeof body.modelConfig === 'object' && typeof body.sceneConfig === 'object';

  if (!clothingUrl || !hasValidConfigs) {
    res.status(400).json({ message: '请完整填写服装图、模特配置和场景配置' });
    return;
  }

  let creditsDeducted = false;
  
  try {
    await CreditService.preDeductCredits(req.user!.userId, config.creditPerGeneration);
    creditsDeducted = true;

    const task = await prisma.generationTask.create({
      data: {
        userId: req.user!.userId,
        creditCost: config.creditPerGeneration,
        clothingUrl,
        modelConfig: JSON.stringify(body.modelConfig),
        sceneConfig: JSON.stringify(body.sceneConfig),
      },
    });

    enqueueGenerationTask(task.id);

    res.status(201).json({ task: serializeTask(task, req) });
  } catch (error) {
    // 只有在积分已扣除的情况下才退款
    if (creditsDeducted) {
      await CreditService.refundCredits(req.user!.userId, config.creditPerGeneration, 'task_creation_refund').catch(console.error);
    }
    res.status(400).json({ message: error instanceof Error ? error.message : '创建任务失败' });
  }
});

router.post('/:id/upscale', async (req, res) => {
  const { factor = 2 } = req.body as { factor?: number };
  const upscaleFactor = factor === 4 ? 4 : 2;
  let task: Awaited<ReturnType<typeof prisma.generationTask.findUnique>> = null;
  let creditsDeducted = false;

  try {
    task = await prisma.generationTask.findUnique({
      where: { id: req.params.id },
    });

    if (!task) {
      res.status(404).json({ message: '任务不存在' });
      return;
    }

    const isOwner = task.userId === req.user!.userId;
    const isAdmin = req.user!.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      res.status(403).json({ message: '无权操作该任务' });
      return;
    }

    if (task.status !== 'DONE') {
      res.status(400).json({ message: '只能放大已完成的任务' });
      return;
    }

    if (!task.resultUrl) {
      res.status(400).json({ message: '任务没有生成结果图片' });
      return;
    }

    await CreditService.preDeductCredits(req.user!.userId, config.creditPerUpscale);
    creditsDeducted = true;

    await prisma.generationTask.update({
      where: { id: req.params.id },
      data: {
        status: 'PROCESSING',
      },
    });

    pushTaskUpdate(task.userId, {
      status: 'PROCESSING',
      progress: 0,
      message: '正在放大图片...',
    });

    // 获取用户的 API Key，优先使用用户个人 Key
    const taskUser = await prisma.user.findUnique({ where: { id: task.userId }, select: { apiKey: true } });
    const userApiKey = taskUser?.apiKey || undefined;

    const upscaledUrl = await AIService.upscaleImage(task.id, task.resultUrl, upscaleFactor, userApiKey);

    const updatedTask = await prisma.generationTask.update({
      where: { id: req.params.id },
      data: {
        status: 'DONE',
        upscaledUrl,
        upscaleFactor,
        finishedAt: new Date(),
      },
    });

    await CreditService.logCreditChange(
      task.userId,
      -config.creditPerUpscale,
      `图片放大 ${upscaleFactor}x`,
    );

    pushTaskUpdate(task.userId, {
      status: 'DONE',
      progress: 100,
      message: '图片放大完成',
      result: serializeTask(updatedTask, req),
    });

    res.json({ task: serializeTask(updatedTask, req) });
  } catch (error) {
    const taskId = req.params.id;
    
    // 只有在积分已扣除的情况下才退款
    if (creditsDeducted && task?.userId) {
      await CreditService.refundCredits(task.userId, config.creditPerUpscale, 'upscale_refund').catch(console.error);
    }
    
    await prisma.generationTask.update({
      where: { id: taskId },
      data: {
        status: 'FAILED',
        errorMsg: error instanceof Error ? error.message : '放大失败',
      },
    }).catch(() => {});

    if (task?.userId) {
      pushTaskUpdate(task.userId, {
        status: 'FAILED',
        message: error instanceof Error ? error.message : '放大失败',
      });
    }

    res.status(500).json({ message: error instanceof Error ? error.message : '放大失败' });
  }
});

router.get('/:id', async (req, res) => {
  const task = await prisma.generationTask.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { email: true } },
    },
  });

  if (!task) {
    res.status(404).json({ message: '任务不存在' });
    return;
  }

  const isOwner = task.userId === req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';

  if (!isOwner && !isAdmin) {
    res.status(403).json({ message: '无权访问该任务' });
    return;
  }

  res.json({ task: serializeTask(task, req) });
});

router.delete('/:id', async (req, res) => {
  const task = await prisma.generationTask.findUnique({
    where: { id: req.params.id },
  });

  if (!task) {
    res.status(404).json({ message: '任务不存在' });
    return;
  }

  const isOwner = task.userId === req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';

  if (!isOwner && !isAdmin) {
    res.status(403).json({ message: '无权删除该任务' });
    return;
  }

  try {
    await prisma.generationTask.delete({
      where: { id: req.params.id },
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : '删除任务失败' });
  }
});

export default router;
