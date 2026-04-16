import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

import { env } from '../lib/env.js'
import { AppError } from '../types/errors.js'

interface JwtAccessPayload {
  id: string
  isImpersonating?: boolean
}

// Verifies the JWT access token from the Authorization header.
// Attaches the decoded payload to req.user for downstream handlers.
