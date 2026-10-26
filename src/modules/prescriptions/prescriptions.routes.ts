import { Router } from 'express';
import { prescriptionController } from './prescriptions.controller';
import { authMiddleware } from '../../middlewares/auth';
import { requireRoles } from '../../middlewares/rbac';
import { validateRequest } from '../../middlewares/validate';
import { createPrescriptionSchema } from './prescriptions.schema';

const router = Router();

router.post(
  '/:consultationId/prescriptions',
  authMiddleware,
  requireRoles(['DOCTOR', 'ADMIN']),
  validateRequest({ body: createPrescriptionSchema }),
  prescriptionController.issue
);

router.get(
  '/:consultationId/prescriptions',
  authMiddleware,
  prescriptionController.get
);

export const prescriptionRoutes = router;
