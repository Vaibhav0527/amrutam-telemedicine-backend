import { Router } from 'express';
import { consultationController } from './consultations.controller';
import { authMiddleware } from '../../middlewares/auth';
import { requireRoles } from '../../middlewares/rbac';

const router = Router();

router.get('/', authMiddleware, consultationController.list);

router.get('/:id', authMiddleware, consultationController.getById);

router.patch(
  '/:id/status',
  authMiddleware,
  requireRoles(['DOCTOR', 'ADMIN']),
  consultationController.updateStatus
);

export const consultationRoutes = router;
