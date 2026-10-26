import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { config } from '../config';
import { logger } from './logger';

if (config.NODE_ENV === 'development') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);
}

export const otelSdk = new NodeSDK({
  serviceName: config.OTEL_SERVICE_NAME,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
    }),
  ],
});

export const initializeTracing = async (): Promise<void> => {
  try {
    await otelSdk.start();
    logger.info('🔭 OpenTelemetry tracing initialized successfully');
  } catch (err) {
    logger.error({ err }, 'Failed to initialize OpenTelemetry tracing');
  }
};
