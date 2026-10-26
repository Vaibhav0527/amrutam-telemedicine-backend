import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../common/errors';

export function requireRoles(allowedRoles: Array<'PATIENT' | 'DOCTOR' | 'ADMIN'>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(
        `Access denied. Allowed roles: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`
      );
    }

    next();
  };
}
