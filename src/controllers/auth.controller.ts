import type { Request, Response } from 'express'

import { env } from '../lib/env.js'
import { sendSuccess } from '../lib/json-response.js'
import { AUTH_MESSAGES } from '../messages/auth.messages.js'
import type { RegisterSchema, VerifyEmailSchema } from '../schemas/auth.schema.js'
import * as authService from '../services/auth.service.js'

/**
 * Register a new user and queue email verification
 * @Body input - { email: string, password: string }
 * @returns { message: string; verificationToken?: string }
 */
export async function register(req: Request, res: Response): Promise<void> {
  const data = await authService.processRegistrationRequest(req.body as RegisterSchema, {
    ipAddress: req.ip ?? '',
    userAgent: req.get('user-agent') ?? '',
    exposeVerificationToken: env.NODE_ENV !== 'production',
  })
  sendSuccess(res, data, 202)
}

/**
 * Verify a user's email address
 * @Body token - { token: string }
 * @returns { void }
 */
export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const { token } = req.body as VerifyEmailSchema
  await authService.verifyEmail(token)
  sendSuccess(res, { message: AUTH_MESSAGES.emailVerifiedSuccess })
}
