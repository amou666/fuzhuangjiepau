import express from 'express';
import cors, { type CorsOptions } from 'cors';
import path from 'path';
import { config } from './config';
import { prisma } from './lib/prisma';
import { adminOnly, auth } from './middleware/auth';
import authRouter from './routes/auth';
import auditLogsRouter from './routes/auditLogs';
import customersRouter from './routes/customers';
import { adminCreditsRouter, creditsRouter } from './routes/credits';
import dashboardRouter from './routes/dashboard';
import { adminRecordsRouter, recordsRouter } from './routes/records';
import { statsRouter } from './routes/stats';
import { adminStatsRouter } from './routes/adminStats';
import sseRouter from './routes/sse';
import tasksRouter from './routes/tasks';
import uploadsRouter from './routes/uploads';
import { ensureBaseUsers } from './services/bootstrapService';
import multer from 'multer';
import { ensureUploadDirectories } from './utils/files';

const localOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || config.frontendOrigins.includes(origin) || localOriginPattern.test(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('当前来源未被允许访问 API'));
  },
  credentials: true,
};

export const createApp = () => {
  const app = express();

  app.use(cors(corsOptions));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  ensureUploadDirectories();
  app.use('/uploads', express.static(path.resolve(config.uploadDir)));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/uploads', auth, uploadsRouter);
  app.use('/api/credits', auth, creditsRouter);
  app.use('/api/tasks', auth, tasksRouter);
  app.use('/api/records', auth, recordsRouter);
  app.use('/api/stats', auth, statsRouter);
  app.use('/api/sse', auth, sseRouter);
  app.use('/api/admin/dashboard', auth, adminOnly, dashboardRouter);
  app.use('/api/admin/customers', auth, adminOnly, customersRouter);
  app.use('/api/admin/credits', auth, adminOnly, adminCreditsRouter);
  app.use('/api/admin/records', auth, adminOnly, adminRecordsRouter);
  app.use('/api/admin/audit-logs', auth, adminOnly, auditLogsRouter);
  app.use('/api/admin/stats', auth, adminOnly, adminStatsRouter);

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error.message === '当前来源未被允许访问 API') {
      res.status(403).json({ message: error.message });
      return;
    }

    // Multer 文件上传错误（返回 400 而非 500）
    if (error instanceof multer.MulterError) {
      const maxMb = config.maxUploadSizeMb;
      if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ message: `图片大小不能超过 ${maxMb}MB` });
        return;
      }
      res.status(400).json({ message: '仅支持 PNG、JPG、JPEG、WEBP、GIF、SVG 图片' });
      return;
    }

    res.status(500).json({ message: error.message || '服务器异常' });
  });

  return app;
};

export const app = createApp();

let initializePromise: Promise<void> | null = null;

export const initializeApp = async () => {
  initializePromise ??= (async () => {
    await prisma.$connect();
    await ensureBaseUsers();
  })();

  await initializePromise;
};

export const startServer = async () => {
  await initializeApp();

  return app.listen(config.port, () => {
    console.log(`Backend running at http://localhost:${config.port}`);
  });
};

if (process.env.APP_AUTO_START !== 'false') {
  void startServer();
}

export default app;
