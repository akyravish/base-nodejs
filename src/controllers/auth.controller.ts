import type { Request, Response } from 'express'

import { env } from '../lib/env.js'
import type { RegisterSchema } from '../schemas/auth.schema.js'
import * as authService from '../services/auth.service.js'

export async function register(req: Request, res: Response): Promise<void> {
  const input = req.body as RegisterSchema

  const { userId } = await authService.registerUser(input, {
    ipAddress: req.ip ?? '',
    userAgent: req.get('user-agent') ?? '',
  })

  const verificationToken = authService.generateEmailVerificationToken(userId)

  // In a real app, queue the verification email here instead of returning the token
  // For development, we return it directly for easy testing
  res.status(201).json({
    success: true,
    data: {
      message: 'Account created. Please check your email to verify your address.',
      ...(env.NODE_ENV !== 'production' && { verificationToken }),
    },
  })
}
