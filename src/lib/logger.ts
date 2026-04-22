import { createLogger, format, transports } from 'winston'

import { env } from './env.js'

const { combine, timestamp, errors, json, colorize, simple } = format

export const logger = createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    env.NODE_ENV === 'production' ? json() : simple(),
  ),
  transports: [new transports.Console({ format: combine(colorize(), simple()) })],
  exitOnError: false, // Don't exit on errors. Let global error handler handle it.
})
