import { beforeEach, describe, expect, it, vi } from 'vitest'

import { testClient } from '../../helpers/testClient.js'

vi.mock('../../../src/lib/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
}))

vi.mock('../../../src/lib/redis.js', () => ({
  redis: {
    ping: vi.fn().mockResolvedValue('PONG'),
  },
  getCache: vi.fn(),
  setCache: vi.fn(),
  deleteCache: vi.fn(),
  clearCachePattern: vi.fn(),
}))

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with correct shape when all services are healthy', async () => {
    const res = await testClient.get('/api/health')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toMatchObject({
      status: 'ok',
      timestamp: expect.any(String),
      uptime: expect.any(Number),
      checks: {
        database: { status: 'ok', latencyMs: expect.any(Number) },
        redis: { status: 'ok', latencyMs: expect.any(Number) },
      },
    })
  })

  it('returns 503 with degraded status when database is down', async () => {
    const { prisma } = await import('../../../src/lib/prisma.js')
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('Connection refused'))

    const res = await testClient.get('/api/health')

    expect(res.status).toBe(503)
    expect(res.body.success).toBe(false)
    expect(res.body.data.status).toBe('degraded')
    expect(res.body.data.checks.database.status).toBe('error')
    expect(res.body.data.checks.redis.status).toBe('ok')
  })

  it('returns 503 with degraded status when Redis is down', async () => {
    const { redis } = await import('../../../src/lib/redis.js')
    vi.mocked(redis.ping).mockRejectedValueOnce(new Error('Redis timeout'))

    const res = await testClient.get('/api/health')

    expect(res.status).toBe(503)
    expect(res.body.success).toBe(false)
    expect(res.body.data.status).toBe('degraded')
    expect(res.body.data.checks.database.status).toBe('ok')
    expect(res.body.data.checks.redis.status).toBe('error')
  })

  it('returns 404 for unknown routes', async () => {
    const res = await testClient.get('/api/nonexistent')

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})
