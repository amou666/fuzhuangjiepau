import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/auth';

export const auth = (req: Request, res: Response, next: NextFunction) => {
  // 优先从 Authorization Header 取 token，其次允许 SSE 场景下通过 query param 传递
  const authorization = req.headers.authorization;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : queryToken;

  if (!token) {
    res.status(401).json({ message: '未提供有效的访问令牌' });
    return;
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ message: '访问令牌已失效，请重新登录' });
  }
};

export const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ message: '仅管理员可访问该资源' });
    return;
  }

  next();
};
