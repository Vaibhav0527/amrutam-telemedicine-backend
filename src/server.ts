import app from './app';
import { config } from './config';
import { logger } from './observability/logger';
import { connectDatabase, disconnectDatabase } from './database/prisma';
import { connectRedis } from './cache/redis';
import { initializeTracing } from './observability/tracer';

async function bootstrap() {
  logger.info('🚀 Starting Amrutam Telemedicine Backend...');

  // 1. Initialize Distributed Tracing
  await initializeTracing();

  // 2. Connect Database & Redis
  await connectDatabase();
  await connectRedis();

  // 3. Start Express HTTP Server
  const server = app.listen(config.PORT, config.HOST, () => {
    logger.info(`🌿 Amrutam Telemedicine API running on http://${config.HOST}:${config.PORT}`);
    logger.info(`📖 Interactive API Documentation: http://${config.HOST}:${config.PORT}/api/docs`);
    logger.info(`📊 Prometheus Metrics: http://${config.HOST}:${config.PORT}/metrics`);
    logger.info(`🩺 Health Liveness: http://${config.HOST}:${config.PORT}/health/liveness`);
  });

  // 4. Graceful Shutdown Handler
  const handleShutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);

    server.close(async () => {
      logger.info('HTTP server closed. Cleaning up database connections...');
      await disconnectDatabase();
      logger.info('All resources cleanly closed. Exiting process.');
      process.exit(0);
    });

    // Force shutdown after 10s timeout
    setTimeout(() => {
      logger.error('Graceful shutdown timeout exceeded. Forcefully killing process.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Fatal error during application startup');
  process.exit(1);
});
