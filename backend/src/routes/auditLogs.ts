import { Router } from 'express';
import { AuditService } from '../services/auditService';

const router = Router();

/**
 * GET /api/admin/audit-logs
 * 获取管理员操作审计日志
 */
router.get('/', async (_req, res) => {
  const logs = await AuditService.getLogs(200);
  res.json({ logs });
});

export default router;
