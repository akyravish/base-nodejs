import type { Request, Response } from 'express'

import { getHealthStatus } from './health.service.js'

/** GET /api/health — returns live DB + Redis connectivity status. */
export async function healthCheck(_req: Request, res: Response): Promise<void> {
  const health = await getHealthStatus()
  const statusCode = health.status === 'ok' ? 200 : 503
  res.status(statusCode).json({ success: health.status === 'ok', data: health })
}
