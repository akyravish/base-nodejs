import express from 'express'
import swaggerUi from 'swagger-ui-express'

import { swaggerSpec } from './config/swagger.js'
import { env } from './lib/env.js'
import { globalErrorHandler } from './middlewares/error.middleware.js'
import { notFound } from './middlewares/notFound.js'
import { generalRateLimiter } from './middlewares/rate-limit.middleware.js'
import { requestId } from './middlewares/requestId.js'
import { requestLogger } from './middlewares/requestLogger.js'
import { securityMiddleware } from './middlewares/security.js'
import { healthRouter } from './modules/health/health.route.js'

export function createApp(): express.Application {
  const app = express()

  if (env.TRUST_PROXY) {
    app.set('trust proxy', 1)
  }

  /* ------------------------------ Security (Helmet + CORS + HPP) ------------------------------ */
  app.use(securityMiddleware())

  /* ------------------------------ Request ID ------------------------------ */
  app.use(requestId)

  /* ------------------------------ Request Logger ------------------------------ */
  app.use(requestLogger)

  /* ------------------------------ Body Parsing ------------------------------ */
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true, limit: '10mb' }))

  /* ------------------------------ Rate Limiting ------------------------------ */
  app.use(generalRateLimiter)

  /* ------------------------------ API Docs ------------------------------ */
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

  /* ------------------------------- API Routes ------------------------------- */
  app.use('/api', healthRouter)

  /* ------------------------------- 404 Handler ------------------------------ */
  app.use(notFound)

  /* ------------------------------ Error Handler ------------------------------ */
  app.use(globalErrorHandler)

  return app
}
