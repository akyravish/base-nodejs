import type { CookieOptions, Request, Response } from 'express'

import { env } from '../lib/env.js'
import { sendSuccess } from '../lib/json-response.js'
import { prisma } from '../lib/prisma.js'
import { AUTH_MESSAGES } from '../messages/auth.messages.js'
import type {
  ForgotPasswordSchema,
  LoginSchema,
  RegisterSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
} from '../schemas/auth.schema.js'
import * as authService from '../services/auth.service.js'

const REFRESH_COOKIE_NAME = 'lk_refresh'

function buildRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  }
}

function setRefreshTokenCookie(res: Response, rawRefreshToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, rawRefreshToken, buildRefreshCookieOptions())
}

function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' })
}

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

/**
 * Login a user
 * @Body input - { email: string, password: string }
 * @returns { message: string; token: string }
 */
export async function login(req: Request, res: Response): Promise<void> {
  const input = req.body as LoginSchema
  const { accessToken, refreshToken } = await authService.loginUser(input, {
    ipAddress: req.ip ?? '',
    userAgent: req.get('user-agent') ?? '',
  })

  setRefreshTokenCookie(res, refreshToken)

  sendSuccess(res, { message: AUTH_MESSAGES.loginSuccess, accessToken })
}

/**
 * Logout a user
 * @returns { message: string }
 * @returns { void }
 */
export async function logout(req: Request, res: Response): Promise<void> {
  const rawRefreshToken = req.cookies[REFRESH_COOKIE_NAME] as string | undefined

  if (rawRefreshToken) {
    await authService.revokeRefreshToken(rawRefreshToken)
  }

  clearRefreshTokenCookie(res)

  sendSuccess(res, { message: 'Logged out successfully' })
}

/**
 * Refresh an access token
 * @returns { message: string; accessToken: string }
 * @returns { void }
 */
export async function refreshToken(req: Request, res: Response): Promise<void> {
  const rawRefreshToken = req.cookies[REFRESH_COOKIE_NAME] as string | undefined

  if (!rawRefreshToken) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'No refresh token provided' },
    })
    return
  }

  const { accessToken, refreshToken: newRefreshToken } = await authService.refreshAccessToken(
    rawRefreshToken,
    {
      ipAddress: req.ip ?? '',
      userAgent: req.get('user-agent') ?? '',
    },
  )

  setRefreshTokenCookie(res, newRefreshToken)

  sendSuccess(res, { message: 'Token refreshed successfully', accessToken })
}

/**
 * Generate a password reset token and send an email to the user
 * @Body input - { email: string }
 * @returns { message: string; resetToken?: string }
 */
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const input = req.body as ForgotPasswordSchema

  // Always return success even if email is not found to prevent email enumeration
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true },
  })

  if (user) {
    await authService.passwordResetToken(user.id, user.email)
  }

  sendSuccess(res, { message: AUTH_MESSAGES.forgotPasswordGeneric })
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const input = req.body as ResetPasswordSchema
  await authService.resetPassword(input, {
    ipAddress: req.ip ?? '',
    userAgent: req.get('user-agent') ?? '',
  })
  sendSuccess(res, { message: 'Password reset successfully. Please login with your new password.' })
}
