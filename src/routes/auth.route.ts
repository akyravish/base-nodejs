import { Router } from 'express'

import * as AuthController from '../controllers/auth.controller.js'
import { asyncHandler } from '../middlewares/async-handler.js'
import { authRateLimiter } from '../middlewares/rate-limit.middleware.js'
import { validate } from '../middlewares/validate.middleware.js'
import { registerSchema, verifyEmailSchema } from '../schemas/auth.schema.js'

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
