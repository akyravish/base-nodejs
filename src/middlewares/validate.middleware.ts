import type { Request, Response, NextFunction } from 'express'
import type { ZodSchema } from 'zod'

import { ValidationError } from '../types/errors.js'

type ValidateTarget = 'body' | 'params' | 'query'

// Factory that returns middleware to validate request data against a Zod schema.
// Replaces the validated data on the request object with the parsed (typed) result.
//
// Usage: router.post('/register', validate(registerSchema), AuthController.register
export function validate(schema: ZodSchema, target: ValidateTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target])

    if (!result.success) {
      throw new ValidationError('Request validation failed', result.error.flatten())
    }

    // Replace raw request data with the Zod-parsed and typed version
    // This gives controllers fully typed, validated input
    req[target] = result.data as (typeof req)[typeof target]

    next()
  }
}
