import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../../generated/prisma/client.js'
import { beforeEach, afterAll } from 'vitest'

export const testPrisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL as string),
})

// Clean all the tables n reverse dependencies order before each test
beforeEach(async () => {
  await testPrisma.$transaction([
    testPrisma.refreshToken.deleteMany(),
    testPrisma.loginAttempt.deleteMany(),
    testPrisma.auditLog.deleteMany(),
    testPrisma.user.deleteMany(),
  ])
})

afterAll(async () => {
  await testPrisma.$disconnect()
})
