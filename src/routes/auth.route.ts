import { Router } from 'express'

import * as AuthController from '../controllers/auth.controller.js'
import { asyncHandler } from '../middlewares/async-handler.js'
import { validate } from '../middlewares/validate.middleware.js'
import { registerSchema } from '../schemas/auth.schema.js'

export const authRouter = Router()

/* ------------------------------ Public routes ----------------------------- */
authRouter.post('/register', validate(registerSchema), asyncHandler(AuthController.register))
