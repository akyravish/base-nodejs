import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import type { Request, Response } from 'express'
import helmet from 'helmet'

import { env } from './lib/env.js'
import { globalErrorHandler } from './middlewares/error.middleware.js'

export function createApp(): express.Application {
  const app = express()

  /* ------------------------------ Security Headers ------------------------------ */
  app.use(helmet())

  /* ------------------------------ CORS ------------------------------ */
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow request with no origin (e.g server-to-server, mobile apps, etc.)
        if (!origin) return callback(null, true)

        if (env.ALLOWED_ORIGINS.includes(origin)) {
          return callback(null, true)
        } else {
          callback(new Error(`CORS: Origin ${origin} is not allowed`))
        }
      },
      credentials: true, // Allow cookies and auth headers to be sent
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  )

  /* ------------------------------ Body Parsing ------------------------------ */
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true, limit: '10mb' }))
  app.use(cookieParser())

  /* ------------------------------ Health Check ------------------------------ */
  app.get('/health', (_req: Request, res: Response): void => {
    res
      .status(200)
      .json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } })
  })

  /* ------------------------------- 404 Handler ------------------------------ */
  app.use((_req: Request, res: Response): void => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'The requested route does not exist' },
    })
  })

  /* ------------------------------ Error Handler ------------------------------ */
  app.use(globalErrorHandler)

  return app
}
