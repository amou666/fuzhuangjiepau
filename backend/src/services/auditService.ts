import { prisma } from '../lib/prisma';

export type AuditAction =
  | 'recharge_credits'
  | 'create_customer'
  | 'toggle_customer_status'
  | 'update_api_key'
  | 'delete_record';

export class AuditService {
  static async log(params: {
    adminId: string;
    action: AuditAction;
    targetUserId?: string;
    detail: string;
  }) {
    return prisma.adminAuditLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        targetUserId: params.targetUserId,
        detail: params.detail,
      },
    });
  }

  static async getLogs(limit = 100) {
    return prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        admin: { select: { email: true } },
        targetUser: { select: { email: true } },
      },
    });
  }
}
