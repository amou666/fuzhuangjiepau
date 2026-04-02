import type { Response } from 'express';

interface SseClient {
  userId: string;
  res: Response;
}

const clients = new Map<string, Set<SseClient>>();

/**
 * 注册一个 SSE 客户端连接
 */
export const registerSseClient = (userId: string, res: Response): SseClient => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // 保持连接活跃，每 25 秒发一次心跳
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  const client: SseClient = { userId, res };

  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId)!.add(client);

  res.on('close', () => {
    clearInterval(heartbeat);
    clients.get(userId)?.delete(client);
    if (clients.get(userId)?.size === 0) {
      clients.delete(userId);
    }
  });

  return client;
};

/**
 * 向指定用户的所有 SSE 连接推送任务更新事件
 */
export const pushTaskUpdate = (userId: string, payload: object) => {
  const userClients = clients.get(userId);
  if (!userClients || userClients.size === 0) return;

  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of userClients) {
    try {
      client.res.write(data);
    } catch {
      // 连接已断开，忽略写入错误
    }
  }
};
