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
