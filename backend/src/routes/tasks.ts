import { Router } from 'express';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { enqueueGenerationTask } from '../queues/generationQueue';
import { CreditService } from '../services/creditService';
import { AIService } from '../services/aiService';
import { sseService } from '../services/sseService';
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

  try {
    await CreditService.preDeductCredits(req.user!.userId, config.creditPerGeneration);

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
    res.status(400).json({ message: error instanceof Error ? error.message : '创建任务失败' });
  }
});

router.post('/:id/upscale', async (req, res) => {
  const { factor = 2 } = req.body as { factor?: number };
  const upscaleFactor = factor === 4 ? 4 : 2;

  try {
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

    await prisma.generationTask.update({
      where: { id: req.params.id },
      data: {
        status: 'PROCESSING',
      },
    });

    sseService.pushTaskUpdate(req.params.id, {
      status: 'PROCESSING',
      progress: 0,
      message: '正在放大图片...',
    });

    const upscaledUrl = await AIService.upscaleImage(task.id, task.resultUrl, upscaleFactor);

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

    sseService.pushTaskUpdate(req.params.id, {
      status: 'DONE',
      progress: 100,
      message: '图片放大完成',
      result: serializeTask(updatedTask, req),
    });

    res.json({ task: serializeTask(updatedTask, req) });
  } catch (error) {
    const taskId = req.params.id;
    
    await prisma.generationTask.update({
      where: { id: taskId },
      data: {
        status: 'FAILED',
        errorMsg: error instanceof Error ? error.message : '放大失败',
      },
    }).catch(() => {});

    sseService.pushTaskUpdate(taskId, {
      status: 'FAILED',
      message: error instanceof Error ? error.message : '放大失败',
    });

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
