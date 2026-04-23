import type { Request, Response, NextFunction } from 'express'
import type { ZodType, ZodTypeDef } from 'zod'

import { ValidationError } from '../types/errors.js'

type ValidateTarget = 'body' | 'params' | 'query'

// Factory that returns middleware to validate request data against a Zod schema.
// Replaces the validated data on the request object with the parsed (typed) result.
//
// Usage: router.post('/register', validate(registerSchema), AuthController.register
export function validate<T>(
  schema: ZodType<T, ZodTypeDef, unknown>,
  target: ValidateTarget = 'body',
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target])

    if (!result.success) {
      throw new ValidationError('Request validation failed', result.error.flatten())
    }

    if (target === 'body') {
      req.body = result.data
    } else if (target === 'params') {
      req.params = result.data as Request['params']
    } else {
      req.query = result.data as Request['query']
    }

    next()
  }
}
