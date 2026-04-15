import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import helmet from 'helmet'

export function createApp(): express.Application {
  const app = express()

  /* ------------------------------ Security Headers ------------------------------ */
  app.use(helmet())

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

  return app
}
