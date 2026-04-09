import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { auth } from '../middleware/auth';
import { registerSseClient } from '../services/sseService';
import { verifyAccessToken } from '../utils/auth';

const router = Router();

/**
 * POST /api/sse/token
 * 生成短期 SSE token（有效期5分钟）
 * 需要 auth 中间件验证身份
 */
router.post('/token', auth, (req, res) => {
  const userId = req.user!.userId;
  
  // 生成 SSE token（30 分钟有效，前端会在过期后自动重连获取新 token）
  const sseToken = jwt.sign(
    { userId, type: 'sse' },
    config.jwtSecret,
    { expiresIn: '30m' }
  );
  
  res.json({ sseToken });
});

/**
 * GET /api/sse/tasks
 * 建立 SSE 长连接，接收当前用户的任务状态推送
 * 支持两种认证方式：
 * 1. 短期 SSE token（type=sse，5分钟有效）
 * 2. 普通 accessToken（兼容前端直接传递）
 */
router.get('/tasks', (req, res, next) => {
  const token = req.query.token as string;
  
  if (!token) {
    res.status(401).json({ message: '缺少 SSE token' });
    return;
  }
  
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string; type?: string };
    
    // 支持两种 token：短期 SSE token 或普通 accessToken
    if (decoded.type === 'sse') {
      // 短期 SSE token
      registerSseClient(decoded.userId, res);
      res.write(`data: ${JSON.stringify({ type: 'connected', userId: decoded.userId })}\n\n`);
    } else {
      // 普通 accessToken - 通过 verifyAccessToken 做完整验证
      const payload = verifyAccessToken(token);
      registerSseClient(payload.userId, res);
      res.write(`data: ${JSON.stringify({ type: 'connected', userId: payload.userId })}\n\n`);
    }
  } catch (error) {
    res.status(401).json({ message: 'SSE token 无效或已过期' });
  }
});

export default router;
