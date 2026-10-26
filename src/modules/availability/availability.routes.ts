import { Router } from 'express';
import { availabilityController } from './availability.controller';
import { authMiddleware } from '../../middlewares/auth';
import { requireRoles } from '../../middlewares/rbac';
import { validateRequest } from '../../middlewares/validate';
import { createSlotsSchema, getSlotsQuerySchema } from './availability.schema';

const router = Router();

router.post(
  '/:doctorId/slots',
  authMiddleware,
  requireRoles(['DOCTOR', 'ADMIN']),
  validateRequest({ body: createSlotsSchema }),
  availabilityController.createSlots
);

router.get(
  '/:doctorId/slots',
  validateRequest({ query: getSlotsQuerySchema }),
  availabilityController.getSlots
);

export const availabilityRoutes = router;
