import type { NextFunction, Request, Response } from 'express'
import type { ZodType, ZodTypeDef } from 'zod'

import { ValidationError } from '../types/errors.js'

interface ValidationSchemas {
  body?: ZodType<unknown, ZodTypeDef, unknown>
  params?: ZodType<unknown, ZodTypeDef, unknown>
  query?: ZodType<unknown, ZodTypeDef, unknown>
}

/**
 * Middleware factory that validates request data against Zod schemas.
 * Usage: router.post('/users', validate({ body: createUserSchema }), controller.create)
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.body !== undefined) {
      const result = schemas.body.safeParse(req.body)
      if (!result.success) {
        throw new ValidationError('Request validation failed', result.error.flatten())
      }
      req.body = result.data
    }

    if (schemas.params !== undefined) {
      const result = schemas.params.safeParse(req.params)
      if (!result.success) {
        throw new ValidationError('Request validation failed', result.error.flatten())
      }
      req.params = result.data as Request['params']
    }

    if (schemas.query !== undefined) {
      const result = schemas.query.safeParse(req.query)
      if (!result.success) {
        throw new ValidationError('Request validation failed', result.error.flatten())
      }
      req.query = result.data as Request['query']
    }

    next()
  }
}
