import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/amrutam_telemedicine?schema=public'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(16).default('amrutam_telemedicine_super_jwt_secret_key_32chars'),
  JWT_REFRESH_SECRET: z.string().min(16).default('amrutam_telemedicine_super_refresh_secret_key_32chars'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  ENCRYPTION_KEY: z.string().length(64).default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 mins
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(1000),
  CORS_ORIGIN: z.string().default('*'),
  OTEL_SERVICE_NAME: z.string().default('amrutam-telemedicine-backend'),
  METRICS_PORT: z.coerce.number().default(9090),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment configuration:', JSON.stringify(parsedEnv.error.format(), null, 2));
  throw new Error('Environment variable validation failed');
}

export const config = parsedEnv.data;
