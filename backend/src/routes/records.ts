import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { serializeTask } from '../utils/taskSerializer';

export const recordsRouter = Router();
export const adminRecordsRouter = Router();

recordsRouter.get('/', async (req, res) => {
  const tasks = await prisma.generationTask.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ records: tasks.map((task) => serializeTask(task, req)) });
});

adminRecordsRouter.get('/', async (req, res) => {
  const tasks = await prisma.generationTask.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { email: true },
      },
    },
  });

  res.json({ records: tasks.map((task) => serializeTask(task, req)) });
});
