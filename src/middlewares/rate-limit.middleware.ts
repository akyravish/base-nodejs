import { rateLimit } from 'express-rate-limit'
import { RedisReply, RedisStore } from 'rate-limit-redis'
import type { Redis } from 'ioredis'
import type { Request, Response } from 'express'

import { redis } from '../lib/redis.js'
import { env } from '../lib/env.js'

// General API rate limiter — applied to all authenticated routes
export const generalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS, // it is the time window in milliseconds
  max: env.RATE_LIMIT_MAX, // maximum number of requests allowed within the window
  standardHeaders: 'draft-7', // Use the draft-7 standard headers
  store: new RedisStore({
    sendCommand: (...args: Parameters<Redis['call']>): Promise<RedisReply> =>
      redis.call(...args) as unknown as Promise<RedisReply>,
    prefix: 'rl:general:',
  }),
  keyGenerator: (req: Request): Promise<string> => Promise.resolve(req.user?.id || req.ip || ''),
  skipSuccessfulRequests: true,
  handler: (req: Request, res: Response) => {
    const retryAfter = req.rateLimit?.resetTime
      ? Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000)
      : undefined

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
      },
      retryAfter,
    })
  },
})

// Stricter rate limiter for authenticated routes
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  store: new RedisStore({
    sendCommand: (...args: Parameters<Redis['call']>): Promise<RedisReply> =>
      redis.call(...args) as unknown as Promise<RedisReply>,
    prefix: 'rl:auth:',
  }),
  keyGenerator: (req: Request): Promise<string> => Promise.resolve(req.user?.id || req.ip || ''),
  skipSuccessfulRequests: true,
  handler: (req: Request, res: Response) => {
    const retryAfter = req.rateLimit?.resetTime
      ? Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000)
      : undefined

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts. Please try again after in 15 minutes.',
      },
      retryAfter,
    })
  },
})
