import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeEach } from 'vitest'

import { PrismaClient } from '../../generated/prisma/client.js'

export const testPrisma = new PrismaClient({
  adapter: new PrismaPg(process.env['DATABASE_URL'] as string),
})

// Clean tables before each test to ensure isolation
beforeEach(async () => {
  await testPrisma.$transaction([testPrisma.user.deleteMany()])
})

afterAll(async () => {
  await testPrisma.$disconnect()
})
