import { createApp } from './app.js'
import { env } from './lib/env.js'
import { logger } from './lib/logger.js'
import { setupProcessErrorHandlers } from './middlewares/error.middleware.js'
import { redis } from './lib/redis.js'
import { prisma } from './lib/prisma.js'

setupProcessErrorHandlers() // Setup process error handlers to gracefully shutdown the app

async function startServer(): Promise<void> {
  await prisma.$connect()
  logger.info('Database connected successfully')

  await redis.ping()
  logger.info('Redis connected successfully and ready to use')

  const app = createApp()

  const server = app.listen(env.PORT, () => {
    logger.info(`Server is running on port ${env.PORT} in ${env.NODE_ENV} mode`)
  })

  // Graceful shutdown - close connections cleanly on SIGTERM/SIGINT
  async function shutdown(): Promise<void> {
    logger.info('Shutting down server...')

    server.close(async () => {
      await prisma.$disconnect()
      await redis.quit()
      logger.info('All connections closed. Exiting...')
      process.exit(0)
    })

    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
      logger.error('Forced shutdown after timeout.')
      process.exit(1)
    }, 10_000)
  }

  // Handle shutdown signals
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

void startServer()
