import { Request, Response } from 'express'

import * as authService from '../services/auth.service.js'
import { RegisterSchema } from '../schemas/auth.schema.js'

export async function register(req: Request, res: Response): Promise<void> {
  const input = req.body as RegisterSchema

  const { userId } = await authService.registerUser(input, {
    ipAddress: req.ip ?? '',
    userAgent: req.get('user-agent') ?? '',
  })
}
