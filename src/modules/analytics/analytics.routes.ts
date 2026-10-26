import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import { authMiddleware } from '../../middlewares/auth';
import { requireRoles } from '../../middlewares/rbac';

const router = Router();

router.get(
  '/analytics/overview',
  authMiddleware,
  requireRoles(['ADMIN']),
  analyticsController.getOverview
);

router.get(
  '/audit-logs',
  authMiddleware,
  requireRoles(['ADMIN']),
  analyticsController.getAuditLogs
);

export const adminRoutes = router;
