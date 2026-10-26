import { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/errors';
import { sendError } from '../common/response';
import { logger } from '../observability/logger';
import { config } from '../config';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const correlationId = req.correlationId || 'unknown';

  if (err instanceof AppError) {
    logger.warn({
      correlationId,
      errorCode: err.errorCode,
      statusCode: err.statusCode,
      message: err.message,
      details: err.details,
      path: req.originalUrl,
    }, 'Handled Operational Error');

    sendError(res, err.statusCode, err.errorCode, err.message, err.details);
    return;
  }

  // Unhandled Programmer/System Errors
  logger.error({
    correlationId,
    err: err.message,
    stack: err.stack,
    path: req.originalUrl,
  }, '🚨 Unhandled System Exception');

  sendError(
    res,
    500,
    'INTERNAL_SERVER_ERROR',
    config.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again later.'
      : err.message
  );
}
