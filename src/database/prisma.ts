import { PrismaClient } from '@prisma/client';
import { logger } from '../observability/logger';
import { dbQueryDurationHistogram } from '../observability/metrics';

export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'info' },
    { emit: 'event', level: 'warn' },
  ],
});

// Query performance metrics & debugging
// @ts-ignore
prisma.$on('query', (e: any) => {
  const durationInSeconds = e.duration / 1000;
  // Track latency in Prometheus
  dbQueryDurationHistogram.observe(
    { operation: 'query', model: 'database' },
    durationInSeconds
  );

  if (e.duration > 200) {
    logger.warn(
      { query: e.query, params: e.params, durationMs: e.duration },
      'Slow DB Query detected (>200ms)'
    );
  }
});

// @ts-ignore
prisma.$on('error', (e: any) => {
  logger.error({ err: e.message, target: e.target }, 'Prisma Database Error');
});

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('🐘 Connected to PostgreSQL database via Prisma');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to PostgreSQL database');
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Disconnected from PostgreSQL database');
}
