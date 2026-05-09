import type { Options } from 'express-rate-limit'
import { rateLimit } from 'express-rate-limit'
import type { Redis } from 'ioredis'
import type { RedisReply } from 'rate-limit-redis'
import { RedisStore } from 'rate-limit-redis'

import { env } from '../lib/env.js'
import { redis } from '../lib/redis.js'

function makeRedisStore(prefix: string): RedisStore {
  return new RedisStore({
    sendCommand: (...args: Parameters<Redis['call']>): Promise<RedisReply> =>
      redis.call(...args) as unknown as Promise<RedisReply>,
    prefix,
  })
}

/**
 * Factory that creates a rate limiter with custom options.
 * Falls back to env-configured window/max when not specified.
 */
export function createRateLimiter(options?: Partial<Options>) {
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: makeRedisStore('rl:custom:'),
    keyGenerator: (req) => Promise.resolve(req.ip ?? ''),
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
        },
      })
    },
    ...options,
  })
}

/** General rate limiter applied to all API routes. */
export const generalRateLimiter = createRateLimiter({
  store: makeRedisStore('rl:general:'),
  skipSuccessfulRequests: true,
})
