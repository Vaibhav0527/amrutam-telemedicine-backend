import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getRedisClient } from '../cache/redis';
import { idempotencyCacheHitsCounter } from '../observability/metrics';
import { logger } from '../observability/logger';
import { BadRequestError } from '../common/errors';

const IDEMPOTENCY_TTL_SECONDS = 86400; // 24 hours

export function idempotencyMiddleware(isMandatory = false) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only apply to write methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    const idempotencyKey = req.headers['x-idempotency-key'] as string;

    if (!idempotencyKey) {
      if (isMandatory) {
        throw new BadRequestError('X-Idempotency-Key header is mandatory for this write operation');
      }
      return next();
    }

    const client = getRedisClient();
    const cacheKey = `idempotency:${idempotencyKey}`;
    const requestPayloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(req.body || {}))
      .digest('hex');

    try {
      const cached = await client.get(cacheKey);

      if (cached) {
        const record = JSON.parse(cached);

        // Check if payload altered
        if (record.requestPayloadHash !== requestPayloadHash) {
          throw new BadRequestError(
            'Idempotency key reused with a different request payload. Create a new key.'
          );
        }

        idempotencyCacheHitsCounter.inc();
        logger.info(
          { idempotencyKey, path: req.path },
          '🔁 Returning cached response from Idempotency Store'
        );

        res.setHeader('X-Cache', 'HIT-IDEMPOTENT');
        res.setHeader('X-Idempotency-Key', idempotencyKey);
        res.status(record.statusCode).json(record.body);
        return;
      }

      // Intercept response to store when successfully finished
      const originalJson = res.json.bind(res);
      res.json = (body: any): Response => {
        // Store in cache asynchronously
        const record = {
          statusCode: res.statusCode,
          requestPayloadHash,
          body,
          cachedAt: new Date().toISOString(),
        };

        client
          .set(cacheKey, JSON.stringify(record), 'EX', IDEMPOTENCY_TTL_SECONDS)
          .catch((err) => {
            logger.error({ err, idempotencyKey }, 'Failed to persist idempotency record');
          });

        res.setHeader('X-Cache', 'MISS-IDEMPOTENT');
        res.setHeader('X-Idempotency-Key', idempotencyKey);
        return originalJson(body);
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}
