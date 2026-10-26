import { Router } from 'express';
import { paymentController } from './payments.controller';
import { idempotencyMiddleware } from '../../middlewares/idempotency';

const router = Router();

router.post(
  '/webhook',
  idempotencyMiddleware(false),
  paymentController.handleWebhook
);

export const paymentRoutes = router;
