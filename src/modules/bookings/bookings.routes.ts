import { Router } from 'express';
import { bookingController } from './bookings.controller';
import { authMiddleware } from '../../middlewares/auth';
import { requireRoles } from '../../middlewares/rbac';
import { validateRequest } from '../../middlewares/validate';
import { idempotencyMiddleware } from '../../middlewares/idempotency';
import { createBookingSchema } from './bookings.schema';

const router = Router();

router.post(
  '/',
  authMiddleware,
  requireRoles(['PATIENT', 'ADMIN']),
  idempotencyMiddleware(false),
  validateRequest({ body: createBookingSchema }),
  bookingController.createBooking
);

router.get('/:id', authMiddleware, bookingController.getStatus);

export const bookingRoutes = router;
