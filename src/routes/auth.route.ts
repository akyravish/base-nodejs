import { Router } from 'express'

import * as AuthController from '../controllers/auth.controller.js'
import { asyncHandler } from '../middlewares/async-handler.js'
import { authenticate } from '../middlewares/auth.middleware.js'
import { authRateLimiter, sessionCookieRateLimiter } from '../middlewares/rate-limit.middleware.js'
import { validate } from '../middlewares/validate.middleware.js'
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  revokeSessionBodySchema,
  verifyEmailSchema,
} from '../schemas/auth.schema.js'

export const authRouter = Router()

/* ------------------------------ Public routes ----------------------------- */
authRouter.post(
  '/register',
  authRateLimiter,
  validate(registerSchema),
  asyncHandler(AuthController.register),
)
authRouter.post(
  '/verify-email',
  authRateLimiter,
  validate(verifyEmailSchema),
  asyncHandler(AuthController.verifyEmail),
)
authRouter.post(
  '/login',
  authRateLimiter,
  validate(loginSchema),
  asyncHandler(AuthController.login),
)
authRouter.post('/logout', sessionCookieRateLimiter, asyncHandler(AuthController.logout))
authRouter.post('/refresh', sessionCookieRateLimiter, asyncHandler(AuthController.refreshToken))
authRouter.post(
  '/forgot-password',
  authRateLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(AuthController.forgotPassword),
)
authRouter.post(
  '/reset-password',
  authRateLimiter,
  validate(resetPasswordSchema),
  asyncHandler(AuthController.resetPassword),
)

/* ------------------------------ Private routes ----------------------------- */
authRouter.get('/sessions', authenticate, asyncHandler(AuthController.getSessions))
authRouter.post(
  '/sessions/revoke',
  authenticate,
  validate(revokeSessionBodySchema),
  asyncHandler(AuthController.revokeSession),
)
