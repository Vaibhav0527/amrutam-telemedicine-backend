import request from 'supertest';
import app from '../../src/app';

describe('Integration — API Health, Observability & Security', () => {
  it('GET /health/liveness should return 200 and healthy status', async () => {
    const res = await request(app).get('/health/liveness');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /metrics should return Prometheus metrics exposition format', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('amrutam_http_requests_total');
    expect(res.text).toContain('amrutam_http_request_duration_seconds');
  });

  it('POST /api/v1/auth/register should reject empty/invalid payload with 422 Validation Error', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'notanemail' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it('GET /api/v1/admin/analytics/overview should reject unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/v1/admin/analytics/overview');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('Non-existent route should return 404 NOT_FOUND conforming to RFC-7807', async () => {
    const res = await request(app).get('/api/v1/unknown-route-endpoint');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
