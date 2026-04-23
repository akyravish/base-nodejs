import type { Response } from 'express'

/**
 * Sends a uniform JSON success envelope.
 */
export function sendSuccess(res: Response, data: unknown, statusCode = 200): void {
  res.status(statusCode).json({ success: true, data })
}
