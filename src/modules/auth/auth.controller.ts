import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { sendSuccess } from '../../common/response';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(
        req.body,
        req.ip,
        req.get('user-agent')
      );
      sendSuccess(res, result, 'User registered successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(
        req.body,
        req.ip,
        req.get('user-agent')
      );
      sendSuccess(res, result, 'Login successful', 200);
    } catch (err) {
      next(err);
    }
  }

  async setupMfa(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.setupMfa(req.user!.id);
      sendSuccess(res, result, 'MFA setup initialized. Scan the QR code with Google Authenticator.', 200);
    } catch (err) {
      next(err);
    }
  }

  async verifyMfa(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.verifyAndEnableMfa(req.user!.id, req.body.mfaToken, req.ip);
      sendSuccess(res, { enabled: true }, 'MFA activated successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.refreshToken(req.body.refreshToken);
      sendSuccess(res, result, 'Token refreshed successfully', 200);
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
