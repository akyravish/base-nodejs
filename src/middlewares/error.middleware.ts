import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'

import { Prisma } from '../../generated/prisma/client.js'
import { env } from '../lib/env.js'
import { logger } from '../lib/logger.js'
import { AppError, ConflictError, NotFoundError, ValidationError } from '../types/errors.js'

interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
    stack?: string
  }
}

// Translates Prisma-specific errors into our typed AppError subclasses.
// This keeps database error handling centralized rather than scattered across services.
function normalizePrismaError(error: Prisma.PrismaClientKnownRequestError): AppError {
  switch (error.code) {
    case 'P2002':
      return new ConflictError('A record with this value already exists')
    case 'P2025':
      return new NotFoundError()
    default:
      return new AppError('Database operation failed', 500, 'DB_ERROR')
  }
}

export function globalErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let appError: AppError

  if (error instanceof AppError) {
    appError = error
  } else if (error instanceof ZodError) {
    appError = new ValidationError('Request Validation failed', error.flatten())
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    appError = normalizePrismaError(error)
  } else {
    // Unexpected error — log full details internally, return generic message to client
    logger.error('Unhandled error:', { error: error.message, stack: error.stack, path: req.path })
    appError = new AppError('An unexpected error occurred', 500, 'INTERNAL_ERROR')
  }

  if (appError.statusCode >= 500) {
    logger.error(`[${appError.code}] ${appError.message}`, {
      path: req.path,
      method: req.method,
      stack: appError.stack,
    })
  }

  const responseBody: ErrorResponse = {
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      // Only include validation details and stack in non-production environments
      ...(appError instanceof ValidationError && { details: appError.details }),
      ...(env.NODE_ENV !== 'production' && { stack: appError.stack }),
    },
  }

  res.status(appError.statusCode).json(responseBody)
}

// Catches unhandled promise rejections from process-level events
export function setupProcessErrorHandlers(): void {
  process.on('unhandledRejection', (reason: unknown): void => {
    logger.error('Unhandled Promise Rejeciton: ', reason)
  })

  process.on('uncaughtException', (error: Error): void => {
    logger.error('Uncaught Exception: ', error)
    // Give the process time to log before exiting
    setTimeout(() => process.exit(), 500)
  })
}
