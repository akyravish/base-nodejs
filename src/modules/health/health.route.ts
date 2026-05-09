import { Router } from 'express'

import { asyncHandler } from '../../middlewares/async-handler.js'
import { healthCheck } from './health.controller.js'

export const healthRouter = Router()

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     description: Returns application health including live database and Redis connectivity checks.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: All services healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: ok
 *                     timestamp:
 *                       type: string
 *                       example: "2024-01-01T00:00:00.000Z"
 *                     uptime:
 *                       type: number
 *                       example: 123.45
 *                     checks:
 *                       type: object
 *       503:
 *         description: One or more services degraded
 */
healthRouter.get('/health', asyncHandler(healthCheck))
