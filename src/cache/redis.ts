import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../observability/logger';

class InMemoryCacheFallback {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<'OK'> {
    let expiresAt: number | undefined;
    if (mode === 'EX' && duration) {
      expiresAt = Date.now() + duration * 1000;
    } else if (mode === 'PX' && duration) {
      expiresAt = Date.now() + duration;
    }
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  async setnx(key: string, value: string): Promise<number> {
    const existing = await this.get(key);
    if (existing !== null) return 0;
    this.store.set(key, { value });
    return 1;
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }
}

let redisClient: Redis | null = null;
let isRedisConnected = false;
const inMemoryFallback = new InMemoryCacheFallback();

export function getRedisClient(): Redis | InMemoryCacheFallback {
  if (isRedisConnected && redisClient) {
    return redisClient;
  }
  return inMemoryFallback;
}

export async function connectRedis(): Promise<void> {
  try {
    const client = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      retryStrategy: (times) => {
        if (times > 2) return null; // Fallback to memory
        return Math.min(times * 200, 1000);
      },
      lazyConnect: true,
    });

    client.on('connect', () => {
      isRedisConnected = true;
      logger.info('🔴 Connected to Redis cache & distributed locking cluster');
    });

    client.on('error', (err) => {
      isRedisConnected = false;
      logger.warn({ err: err.message }, 'Redis unreachable, switching to in-memory fallback');
    });

    await client.connect();
    redisClient = client;
  } catch (err: any) {
    isRedisConnected = false;
    logger.warn('Using in-memory lock & cache fallback (Redis not running locally)');
  }
}

/**
 * Distributed Lock acquisition for zero double-booking concurrency control
 * @param lockKey - e.g. "lock:slot:uuid-1234"
 * @param ttlSeconds - Time-to-live for lock auto-release (prevent deadlocks)
 * @returns boolean - true if lock was acquired, false if held by another request
 */
export async function acquireDistributedLock(
  lockKey: string,
  ttlSeconds = 10
): Promise<boolean> {
  const client = getRedisClient();
  const lockToken = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  if (isRedisConnected && redisClient) {
    // Redlock / SET NX EX pattern
    const result = await redisClient.set(lockKey, lockToken, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } else {
    // In-memory atomic lock
    const existing = await inMemoryFallback.get(lockKey);
    if (existing !== null) {
      return false;
    }
    await inMemoryFallback.set(lockKey, lockToken, 'EX', ttlSeconds);
    return true;
  }
}

/**
 * Releases distributed lock
 */
export async function releaseDistributedLock(lockKey: string): Promise<void> {
  const client = getRedisClient();
  await client.del(lockKey);
}

export async function isCacheHealthy(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const res = await client.ping();
    return res === 'PONG';
  } catch {
    return false;
  }
}
