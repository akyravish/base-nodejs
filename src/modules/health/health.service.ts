import { prisma } from '../../lib/prisma.js'
import { redis } from '../../lib/redis.js'

interface HealthCheck {
  status: 'ok' | 'error'
  latencyMs?: number
}

export interface HealthStatus {
  status: 'ok' | 'degraded'
  timestamp: string
  uptime: number
  checks: {
    database: HealthCheck
    redis: HealthCheck
  }
}

async function checkDatabase(): Promise<HealthCheck> {
  try {
    const start = Date.now()
    await prisma.$queryRaw`SELECT 1`
    return { status: 'ok', latencyMs: Date.now() - start }
  } catch {
    return { status: 'error' }
  }
}

async function checkRedis(): Promise<HealthCheck> {
  try {
    const start = Date.now()
    await redis.ping()
    return { status: 'ok', latencyMs: Date.now() - start }
  } catch {
    return { status: 'error' }
  }
}

/** Checks database and Redis connectivity and returns a combined health status. */
export async function getHealthStatus(): Promise<HealthStatus> {
  const [database, redisCheck] = await Promise.all([checkDatabase(), checkRedis()])
  const allOk = database.status === 'ok' && redisCheck.status === 'ok'

  return {
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: { database, redis: redisCheck },
  }
}
