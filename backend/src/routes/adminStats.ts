import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const adminStatsRouter = Router();

adminStatsRouter.get('/keywords', async (req, res) => {
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;
  const limit = parseInt(req.query.limit as string) || 50;

  const whereClause: { createdAt?: { gte?: Date; lte?: Date } } = {};
  
  if (startDate || endDate) {
    whereClause.createdAt = {};
    if (startDate) {
      whereClause.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      whereClause.createdAt.lte = end;
    }
  }

  const tasks = await prisma.generationTask.findMany({
    where: whereClause,
    select: {
      modelConfig: true,
      sceneConfig: true,
      clothingDescription: true,
      createdAt: true,
    },
  });

  // 提取关键词并统计频率
  const keywordStats: Record<string, { count: number; type: string }> = {};

  tasks.forEach((task) => {
    // 从 modelConfig 提取关键词
    try {
      const modelConfig = JSON.parse(task.modelConfig as string);
      const fields = ['gender', 'skinTone', 'bodyType', 'pose', 'expression'];
      fields.forEach((field) => {
        const value = modelConfig[field];
        if (value && typeof value === 'string') {
          const key = `${field}:${value}`;
          if (!keywordStats[key]) {
            keywordStats[key] = { count: 0, type: field };
          }
          keywordStats[key].count += 1;
        }
      });
    } catch {
      // 忽略解析错误
    }

    // 从 sceneConfig 提取关键词
    try {
      const sceneConfig = JSON.parse(task.sceneConfig as string);
      if (sceneConfig.preset) {
        const key = `scene:${sceneConfig.preset}`;
        if (!keywordStats[key]) {
          keywordStats[key] = { count: 0, type: 'scene' };
        }
        keywordStats[key].count += 1;
      }
      if (sceneConfig.prompt) {
        // 简单分词提取关键词
        const words = sceneConfig.prompt
          .toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter((word: string) => word.length > 3);
        words.forEach((word: string) => {
          const key = `prompt:${word}`;
          if (!keywordStats[key]) {
            keywordStats[key] = { count: 0, type: 'prompt' };
          }
          keywordStats[key].count += 1;
        });
      }
    } catch {
      // 忽略解析错误
    }

    // 从服装描述提取关键词
    if (task.clothingDescription) {
      const words = task.clothingDescription
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 3);
      words.forEach((word) => {
        const key = `clothing:${word}`;
        if (!keywordStats[key]) {
          keywordStats[key] = { count: 0, type: 'clothing' };
        }
        keywordStats[key].count += 1;
      });
    }
  });

  // 排序并返回 Top N
  const sortedKeywords = Object.entries(keywordStats)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([key, stats]) => ({
      keyword: key,
      count: stats.count,
      type: stats.type,
    }));

  // 按类型分组统计
  const typeGroups: Record<string, Array<{ keyword: string; count: number }>> = {};
  sortedKeywords.forEach((item) => {
    if (!typeGroups[item.type]) {
      typeGroups[item.type] = [];
    }
    typeGroups[item.type].push({
      keyword: item.keyword,
      count: item.count,
    });
  });

  // 计算时间趋势（按周聚合）
  const weeklyTrends: Record<string, Record<string, number>> = {};
  tasks.forEach((task) => {
    const weekStart = new Date(task.createdAt);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!weeklyTrends[weekKey]) {
      weeklyTrends[weekKey] = {};
    }

    // 统计该周的场景偏好
    try {
      const sceneConfig = JSON.parse(task.sceneConfig as string);
      if (sceneConfig.preset) {
        if (!weeklyTrends[weekKey][sceneConfig.preset]) {
          weeklyTrends[weekKey][sceneConfig.preset] = 0;
        }
        weeklyTrends[weekKey][sceneConfig.preset] += 1;
      }
    } catch {
      // 忽略
    }
  });

  res.json({
    topKeywords: sortedKeywords,
    typeGroups,
    weeklyTrends: Object.entries(weeklyTrends)
      .map(([week, keywords]) => ({
        week,
        keywords,
      }))
      .sort((a, b) => a.week.localeCompare(b.week)),
    totalTasks: tasks.length,
  });
});

adminStatsRouter.get('/revenue', async (req, res) => {
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;

  const whereClause: { createdAt?: { gte?: Date; lte?: Date } } = {};
  
  if (startDate || endDate) {
    whereClause.createdAt = {};
    if (startDate) {
      whereClause.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      whereClause.createdAt.lte = end;
    }
  }

  // 获取所有消费日志
  const creditLogs = await prisma.creditLog.findMany({
    where: {
      delta: { lt: 0 }, // 只统计消费（负数）
      ...whereClause,
    },
    select: {
      delta: true,
      reason: true,
      createdAt: true,
      userId: true,
    },
  });

  // 总营收（积分消耗）
  const totalRevenue = creditLogs.reduce((sum, log) => sum + Math.abs(log.delta), 0);

  // 按日期统计
  const dailyRevenue: Record<string, number> = {};
  creditLogs.forEach((log) => {
    const dateKey = log.createdAt.toISOString().split('T')[0];
    if (!dailyRevenue[dateKey]) {
      dailyRevenue[dateKey] = 0;
    }
    dailyRevenue[dateKey] += Math.abs(log.delta);
  });

  // 按月份统计
  const monthlyRevenue: Record<string, number> = {};
  creditLogs.forEach((log) => {
    const monthKey = log.createdAt.toISOString().slice(0, 7); // YYYY-MM
    if (!monthlyRevenue[monthKey]) {
      monthlyRevenue[monthKey] = 0;
    }
    monthlyRevenue[monthKey] += Math.abs(log.delta);
  });

  // 按消费类型统计
  const revenueByType: Record<string, number> = {};
  creditLogs.forEach((log) => {
    const type = log.reason.split('_')[0] || 'other';
    if (!revenueByType[type]) {
      revenueByType[type] = 0;
    }
    revenueByType[type] += Math.abs(log.delta);
  });

  // 新老客户分析
  const userFirstTaskDate: Record<string, Date> = {};
  const allTasks = await prisma.generationTask.findMany({
    select: {
      userId: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  allTasks.forEach((task) => {
    if (!userFirstTaskDate[task.userId]) {
      userFirstTaskDate[task.userId] = task.createdAt;
    }
  });

  let newCustomerRevenue = 0;
  let oldCustomerRevenue = 0;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  creditLogs.forEach((log) => {
    const firstDate = userFirstTaskDate[log.userId];
    if (firstDate && log.createdAt.getTime() - firstDate.getTime() < 30 * 24 * 60 * 60 * 1000) {
      newCustomerRevenue += Math.abs(log.delta);
    } else {
      oldCustomerRevenue += Math.abs(log.delta);
    }
  });

  // Top 消费用户
  const userRevenue: Record<string, number> = {};
  creditLogs.forEach((log) => {
    if (!userRevenue[log.userId]) {
      userRevenue[log.userId] = 0;
    }
    userRevenue[log.userId] += Math.abs(log.delta);
  });

  const topUsers = await Promise.all(
    Object.entries(userRevenue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(async ([userId, revenue]) => {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });
        return {
          userId,
          email: user?.email || 'unknown',
          revenue,
        };
      }),
  );

  res.json({
    totalRevenue,
    dailyRevenue: Object.entries(dailyRevenue)
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    monthlyRevenue: Object.entries(monthlyRevenue)
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    revenueByType,
    customerAnalysis: {
      newCustomerRevenue,
      oldCustomerRevenue,
      newCustomerPercentage: totalRevenue > 0 
        ? ((newCustomerRevenue / totalRevenue) * 100).toFixed(1) 
        : '0',
    },
    topUsers,
    transactionCount: creditLogs.length,
  });
});
