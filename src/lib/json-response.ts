import type { Response } from 'express'

/** Sends a standardized JSON success envelope: { success: true, data, message? } */
export function sendSuccess(
  res: Response,
  data: unknown,
  message?: string,
  statusCode = 200,
): void {
  res.status(statusCode).json({ success: true, data, ...(message && { message }) })
}

/** Sends a standardized JSON error envelope: { success: false, error: { message, details? } } */
export function sendError(
  res: Response,
  message: string,
  details?: unknown,
  statusCode = 500,
): void {
  res
    .status(statusCode)
    .json({ success: false, error: { message, ...(details !== undefined && { details }) } })
}
