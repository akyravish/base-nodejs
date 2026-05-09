import { Redis } from 'ioredis'

import { env } from './env.js'
import { logger } from './logger.js'

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    return Math.min(times * 50, 1000)
  }, // Retry connection attempts every 50ms up to 1 second
  enableReadyCheck: true, // Ensure Redis is ready before sending commands
  lazyConnect: true, // Only connect to Redis when a command is issued
})

redis.on('error', (error: Error) => {
  logger.error('Redis error:', error)
})

redis.on('connect', () => {
  logger.info('Connected to Redis')
})

redis.on('disconnect', () => {
  logger.warn('Disconnected from Redis')
})

/** Get a cached value by key. Returns null if not found or expired. */
export async function getCache(key: string): Promise<string | null> {
  return redis.get(key)
}

/** Set a cached value, with optional TTL in seconds. */
export async function setCache(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (ttlSeconds !== undefined) {
    await redis.setex(key, ttlSeconds, value)
  } else {
    await redis.set(key, value)
  }
}

/** Delete a single cached key. */
export async function deleteCache(key: string): Promise<void> {
  await redis.del(key)
}

/**
 * Delete all keys matching a glob pattern (e.g. "user:*").
 * Uses KEYS internally — prefer specific key deletes in high-traffic scenarios.
 */
export async function clearCachePattern(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern)
  if (keys.length > 0) {
    await redis.del(...keys)
  }
}
