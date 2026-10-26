import { prisma } from '../../database/prisma';
import { computeAuditTamperHash } from '../../security/hash';
import { logger } from '../../observability/logger';

export interface CreateAuditEntryInput {
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  previousState?: any;
  newState?: any;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  /**
   * Appends an immutable audit entry with cryptographic hash chaining
   */
  async log(entry: CreateAuditEntryInput): Promise<void> {
    try {
      // Fetch latest hash in chain
      const lastAudit = await prisma.auditLog.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { tamperHash: true },
      });

      const previousHash = lastAudit?.tamperHash || 'GENESIS_HASH_AMRUTAM_2026';
      const now = new Date();

      const tamperHash = computeAuditTamperHash(
        previousHash,
        entry.userId || null,
        entry.action,
        entry.resourceType,
        entry.resourceId || null,
        now.toISOString(),
        { prev: entry.previousState, next: entry.newState }
      );

      await prisma.auditLog.create({
        data: {
          userId: entry.userId || null,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId || null,
          previousState: entry.previousState ? JSON.stringify(entry.previousState) : undefined,
          newState: entry.newState ? JSON.stringify(entry.newState) : undefined,
          ipAddress: entry.ipAddress || null,
          userAgent: entry.userAgent || null,
          tamperHash,
          createdAt: now,
        },
      });
    } catch (err) {
      // Never crash main workflow if audit write fails, but log critical alert
      logger.error({ err, entry }, '🚨 CRITICAL: Failed to write to audit log');
    }
  }

  async getAuditLogs(params: {
    page?: number;
    limit?: number;
    action?: string;
    resourceType?: string;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.action) where.action = params.action;
    if (params.resourceType) where.resourceType = params.resourceType;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, email: true, role: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const auditService = new AuditService();
