import morgan from 'morgan'

import { logger } from '../lib/logger.js'

const stream = {
  write: (message: string) => logger.http(message.trim()),
}

/**
 * HTTP request logger using morgan, piped into Winston.
 * Logs method, url, status, response-time, and request ID.
 * Skipped entirely in test environments.
 */
export const requestLogger = morgan(
  ':method :url :status :res[content-length] - :response-time ms [:req[x-request-id]]',
  {
    stream,
    skip: () => process.env['NODE_ENV'] === 'test',
  },
)
