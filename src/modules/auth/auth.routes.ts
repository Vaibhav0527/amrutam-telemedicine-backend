import { Router } from 'express';
import { authController } from './auth.controller';
import { validateRequest } from '../../middlewares/validate';
import { authMiddleware } from '../../middlewares/auth';
import { authRateLimiter } from '../../middlewares/rateLimiter';
import {
  registerSchema,
  loginSchema,
  mfaVerifySchema,
  refreshTokenSchema,
} from './auth.schema';

const router = Router();

router.post(
  '/register',
  authRateLimiter,
  validateRequest({ body: registerSchema }),
  authController.register
);

router.post(
  '/login',
  authRateLimiter,
  validateRequest({ body: loginSchema }),
  authController.login
);

router.post('/mfa/setup', authMiddleware, authController.setupMfa);

router.post(
  '/mfa/verify',
  authMiddleware,
  validateRequest({ body: mfaVerifySchema }),
  authController.verifyMfa
);

router.post(
  '/refresh',
  validateRequest({ body: refreshTokenSchema }),
  authController.refreshToken
);

export const authRoutes = router;
