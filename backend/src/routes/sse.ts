import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { registerSseClient } from '../services/sseService';

const router = Router();

/**
 * POST /api/sse/token
 * 生成短期 SSE token（有效期5分钟）
 */
router.post('/token', (req, res) => {
  const userId = req.user!.userId;
  
  // 生成短期 SSE token（使用独立的 secret）
  const sseToken = jwt.sign(
    { userId, type: 'sse' },
    config.jwtSecret,
    { expiresIn: '5m' }
  );
  
  res.json({ sseToken });
});

/**
 * GET /api/sse/tasks
 * 建立 SSE 长连接，接收当前用户的任务状态推送
 * 使用短期 SSE token 认证（从 query parameter 获取）
 */
router.get('/tasks', (req, res, next) => {
  const sseToken = req.query.token as string;
  
  if (!sseToken) {
    res.status(401).json({ message: '缺少 SSE token' });
    return;
  }
  
  try {
    // 验证 SSE token
    const payload = jwt.verify(sseToken, config.jwtSecret) as { userId: string; type: string };
    
    if (payload.type !== 'sse') {
      res.status(401).json({ message: '无效的 SSE token' });
      return;
    }
    
    const userId = payload.userId;
    registerSseClient(userId, res);
    // 发送初始连接确认事件
    res.write(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`);
  } catch (error) {
    res.status(401).json({ message: 'SSE token 无效或已过期' });
  }
});

export default router;
