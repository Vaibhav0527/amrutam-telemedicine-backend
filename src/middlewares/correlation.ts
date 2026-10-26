import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../observability/logger';
import { httpRequestCounter, httpRequestDurationHistogram } from '../observability/metrics';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      user?: {
        id: string;
        email: string;
        role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
      };
      startTime: number;
    }
  }
}

export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'] as string;
  const correlationId = incomingId && incomingId.trim() !== '' ? incomingId : uuidv4();

  req.correlationId = correlationId;
  req.startTime = Date.now();
  res.setHeader('X-Request-Id', correlationId);

  // Monitor request metrics and log lifecycle
  res.on('finish', () => {
    const durationMs = Date.now() - req.startTime;
    const durationSec = durationMs / 1000;
    const route = req.route ? req.route.path : req.path;

    httpRequestCounter.inc({
      method: req.method,
      route,
      status_code: res.statusCode.toString(),
    });

    httpRequestDurationHistogram.observe(
      {
        method: req.method,
        route,
        status_code: res.statusCode.toString(),
      },
      durationSec
    );

    logger.info({
      correlationId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    }, 'HTTP Request Completed');
  });

  next();
}
