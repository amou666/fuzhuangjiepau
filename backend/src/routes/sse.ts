import { Router } from 'express';
import { registerSseClient } from '../services/sseService';

const router = Router();

/**
 * GET /api/sse/tasks
 * 建立 SSE 长连接，接收当前用户的任务状态推送
 */
router.get('/tasks', (req, res) => {
  const userId = req.user!.userId;
  registerSseClient(userId, res);
  // 发送初始连接确认事件
  res.write(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`);
});

export default router;
