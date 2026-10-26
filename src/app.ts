import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';

import { config } from './config';
import { correlationMiddleware } from './middlewares/correlation';
import { globalRateLimiter } from './middlewares/rateLimiter';
import { errorHandler } from './middlewares/errorHandler';
import { metricsRegistry } from './observability/metrics';
import { prisma } from './database/prisma';
import { isCacheHealthy } from './cache/redis';
import { sendSuccess } from './common/response';
import { NotFoundError } from './common/errors';

// Route imports
import { authRoutes } from './modules/auth/auth.routes';
import { doctorRoutes } from './modules/doctors/doctors.routes';
import { availabilityRoutes } from './modules/availability/availability.routes';
import { bookingRoutes } from './modules/bookings/bookings.routes';
import { consultationRoutes } from './modules/consultations/consultations.routes';
import { prescriptionRoutes } from './modules/prescriptions/prescriptions.routes';
import { paymentRoutes } from './modules/payments/payments.routes';
import { adminRoutes } from './modules/analytics/analytics.routes';

const app = express();

// Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows Swagger UI to render static assets cleanly
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration
app.use(
  cors({
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Idempotency-Key'],
  })
);

// Request parsing & payload size limit (DoS mitigation)
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Correlation ID & Prometheus request monitoring
app.use(correlationMiddleware);

// Global Rate Limiting
app.use(globalRateLimiter);

// ---------------------- Observability & Health Probes ----------------------

// Prometheus Metrics Endpoint
app.get('/metrics', async (_req: Request, res: Response) => {
  res.setHeader('Content-Type', metricsRegistry.contentType);
  res.send(await metricsRegistry.metrics());
});

// Liveness Probe (K8s / Container)
app.get('/health/liveness', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', service: 'amrutam-telemedicine-backend' });
});

// Readiness Probe (Verifies PostgreSQL & Redis Cache connectivity)
app.get('/health/readiness', async (_req: Request, res: Response) => {
  try {
    // Check DB
    await prisma.$queryRaw`SELECT 1`;
    const dbHealthy = true;

    // Check Redis / Cache
    const cacheHealthy = await isCacheHealthy();

    const isReady = dbHealthy && cacheHealthy;
    const statusCode = isReady ? 200 : 503;

    res.status(statusCode).json({
      status: isReady ? 'READY' : 'DEGRADED',
      dependencies: {
        database: dbHealthy ? 'UP' : 'DOWN',
        cache: cacheHealthy ? 'UP' : 'DOWN',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'NOT_READY',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ---------------------- Interactive Swagger UI ----------------------
try {
  const swaggerDocument = YAML.load(path.join(__dirname, '../openapi.yaml'));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (e) {
  // Fallback if running from dist
  try {
    const swaggerDocument = YAML.load(path.join(process.cwd(), 'openapi.yaml'));
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  } catch (err) {
    console.warn('Swagger docs YAML could not be loaded directly:', err);
  }
}

// Root redirect to docs
app.get('/', (_req: Request, res: Response) => {
  res.redirect('/api/docs');
});

// ---------------------- API v1 Routes ----------------------
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/doctors', availabilityRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/consultations', consultationRoutes);
app.use('/api/v1/consultations', prescriptionRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/admin', adminRoutes);

// 404 Route Catch-all
app.use('*', (req: Request) => {
  throw new NotFoundError(`Endpoint '${req.originalUrl}' does not exist on this server`);
});

// Centralized RFC-7807 Error Handler
app.use(errorHandler);

export default app;
