import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

import { env } from '../lib/env.js'
import { AuthError } from '../types/errors.js'

interface JwtAccessPayload {
  id: string
  isImpersonating?: boolean | undefined | null
}

// Verifies the JWT access token from the Authorization header.
// Attaches the decoded payload to req.user for downstream handlers.
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization']

  if (!authHeader || !authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Missing or malformed Authorization header')
  }

  const token = authHeader.slice(7)

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtAccessPayload

    req.user = {
      id: payload.id,
      isImpersonating: payload.isImpersonating,
    }

    next()
  } catch (error) {
    throw new AuthError('Invalid or expired JWT access token')
  }
}

// Same as authenticate but does not throw — used for routes that work with or without auth
export function optionalAuthenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization']

  if (!authHeader?.startsWith('Bearer ')) {
    return next()
  }

  authenticate(req, res, next)
}
