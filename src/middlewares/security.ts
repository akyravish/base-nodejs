import cors from 'cors'
import type { RequestHandler } from 'express'
import helmet from 'helmet'
import hpp from 'hpp'

import { env } from '../lib/env.js'

/**
 * Returns an array of security middleware: Helmet headers, CORS policy, HPP protection.
 * Applied as the first middleware stack in the app.
 */
export function securityMiddleware(): RequestHandler[] {
  return [
    helmet() as RequestHandler,
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, mobile apps, curl)
        if (!origin) return callback(null, true)
        if (env.ALLOWED_ORIGINS.includes(origin)) {
          return callback(null, true)
        }
        callback(new Error(`CORS: Origin ${origin} is not allowed`))
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    }) as RequestHandler,
    hpp() as RequestHandler,
  ]
}
