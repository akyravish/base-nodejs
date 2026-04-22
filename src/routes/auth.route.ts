import { Router } from 'express'
import { validate } from '../middlewares/validate.middleware.js'
import { registerSchema } from '../schemas/auth.schema.js'
import { asyncHandler } from '../middlewares/async-handler.js'

export const authRouter = Router()

/* ------------------------------ Public routes ----------------------------- */
// authRouter.post('/register', validate(registerSchema), asyncHandler())
