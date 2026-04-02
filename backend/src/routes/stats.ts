import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const statsRouter = Router();

statsRouter.get('/generation', async (req, res) => {
  const userId = req.user!.userId;

  const tasks = await prisma.generationTask.findMany({
    where: { userId },
    select: {
      status: true,
      modelConfig: true,
      sceneConfig: true,
      creditCost: true,
      createdAt: true,
    },
  });

  const totalTasks = tasks.length;
  const successTasks = tasks.filter((t) => t.status === 'DONE').length;
  const failedTasks = tasks.filter((t) => t.status === 'FAILED').length;
  const pendingTasks = tasks.filter((t) => t.status === 'PENDING' || t.status === 'PROCESSING').length;

  // 分析模特配置偏好
  const genderStats: Record<string, number> = {};
  const bodyTypeStats: Record<string, number> = {};
  const poseStats: Record<string, number> = {};

  tasks.forEach((task) => {
    try {
      const modelConfig = JSON.parse(task.modelConfig as string);
      const gender = modelConfig.gender || 'unknown';
      const bodyType = modelConfig.bodyType || 'unknown';
      const pose = modelConfig.pose || 'unknown';

      genderStats[gender] = (genderStats[gender] || 0) + 1;
      bodyTypeStats[bodyType] = (bodyTypeStats[bodyType] || 0) + 1;
      poseStats[pose] = (poseStats[pose] || 0) + 1;
    } catch {
      // 忽略解析错误
    }
  });

  // 分析场景配置偏好
  const scenePresetStats: Record<string, number> = {};
  
  tasks.forEach((task) => {
    try {
      const sceneConfig = JSON.parse(task.sceneConfig as string);
      const preset = sceneConfig.preset || 'unknown';
      scenePresetStats[preset] = (scenePresetStats[preset] || 0) + 1;
    } catch {
      // 忽略解析错误
    }
  });

  // 计算平均处理时长（只统计已完成的任务）
  const completedTasks = await prisma.generationTask.findMany({
    where: {
      userId,
      status: 'DONE',
      finishedAt: { not: null },
    },
    select: {
      createdAt: true,
      finishedAt: true,
    },
  });

  let totalDuration = 0;
  completedTasks.forEach((task) => {
    if (task.finishedAt) {
      const duration = task.finishedAt.getTime() - task.createdAt.getTime();
      totalDuration += duration;
    }
  });

  const avgProcessingTime = completedTasks.length > 0 
    ? Math.round(totalDuration / completedTasks.length / 1000) // 转换为秒
    : 0;

  // 每日生图统计（最近30天）
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentTasks = await prisma.generationTask.findMany({
    where: {
      userId,
      createdAt: { gte: thirtyDaysAgo },
    },
    select: {
      createdAt: true,
      status: true,
    },
  });

  const dailyStats: Record<string, { total: number; success: number; failed: number }> = {};
  recentTasks.forEach((task) => {
    const dateKey = task.createdAt.toISOString().split('T')[0];
    if (!dailyStats[dateKey]) {
      dailyStats[dateKey] = { total: 0, success: 0, failed: 0 };
    }
    dailyStats[dateKey].total += 1;
    if (task.status === 'DONE') {
      dailyStats[dateKey].success += 1;
    } else if (task.status === 'FAILED') {
      dailyStats[dateKey].failed += 1;
    }
  });

  res.json({
    overview: {
      totalTasks,
      successTasks,
      failedTasks,
      pendingTasks,
      successRate: totalTasks > 0 ? ((successTasks / totalTasks) * 100).toFixed(1) : '0',
      avgProcessingTime,
    },
    modelPreferences: {
      gender: genderStats,
      bodyType: bodyTypeStats,
      pose: poseStats,
    },
    scenePreferences: {
      preset: scenePresetStats,
    },
    dailyStats: Object.entries(dailyStats)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  });
});
