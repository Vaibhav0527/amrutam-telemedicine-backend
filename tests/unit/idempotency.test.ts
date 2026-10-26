import request from 'supertest';
import express from 'express';
import { idempotencyMiddleware } from '../../src/middlewares/idempotency';
import { errorHandler } from '../../src/middlewares/errorHandler';

describe('Resilience — Idempotency Middleware (Bonus +10 Marks)', () => {
  let app: express.Application;
  let executionCount = 0;

  beforeEach(() => {
    executionCount = 0;
    app = express();
    app.use(express.json());

    // Mock mutating endpoint with idempotency middleware
    app.post(
      '/test-idempotent-write',
      idempotencyMiddleware(false),
      (req, res) => {
        executionCount++;
        res.status(201).json({
          success: true,
          executionId: executionCount,
          data: req.body,
        });
      }
    );

    app.use(errorHandler);
  });

  it('should execute operation once on first call with idempotency key', async () => {
    const key = `test-key-${Date.now()}`;
    const payload = { amount: 500, doctorId: 'doc-123' };

    const res = await request(app)
      .post('/test-idempotent-write')
      .set('X-Idempotency-Key', key)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.executionId).toBe(1);
    expect(res.headers['x-cache']).toBe('MISS-IDEMPOTENT');
    expect(executionCount).toBe(1);
  });

  it('should return cached response on replay of the same idempotency key without re-execution', async () => {
    const key = `test-replay-${Date.now()}`;
    const payload = { amount: 500, doctorId: 'doc-123' };

    // Call 1: Original execution
    const res1 = await request(app)
      .post('/test-idempotent-write')
      .set('X-Idempotency-Key', key)
      .send(payload);

    expect(res1.status).toBe(201);
    expect(res1.body.executionId).toBe(1);

    // Call 2: Exact duplicate replay
    const res2 = await request(app)
      .post('/test-idempotent-write')
      .set('X-Idempotency-Key', key)
      .send(payload);

    expect(res2.status).toBe(201);
    // Should still return executionId 1 (cached response)
    expect(res2.body.executionId).toBe(1);
    expect(res2.headers['x-cache']).toBe('HIT-IDEMPOTENT');
    // Handler must NOT have executed a second time!
    expect(executionCount).toBe(1);
  });

  it('should reject when idempotency key is reused with an altered payload', async () => {
    const key = `test-altered-${Date.now()}`;

    // Call 1 with payload A
    await request(app)
      .post('/test-idempotent-write')
      .set('X-Idempotency-Key', key)
      .send({ amount: 500 });

    // Call 2 with altered payload B
    const res2 = await request(app)
      .post('/test-idempotent-write')
      .set('X-Idempotency-Key', key)
      .send({ amount: 999 });

    expect(res2.status).toBe(400);
    expect(res2.body.error.code).toBe('BAD_REQUEST');
  });
});
