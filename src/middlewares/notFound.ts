import type { Request, Response } from 'express'

/** Catch-all 404 handler — mount after all routes. */
export function notFound(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'The requested route does not exist' },
  })
}
