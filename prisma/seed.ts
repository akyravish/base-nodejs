import { PrismaClient } from '../generated/prisma/client.js'

const prisma = new PrismaClient()

async function main(): Promise<void> {
  const demo = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
    },
  })

  console.log('Seeded user:', demo.id)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error('Seed failed:', error)
    await prisma.$disconnect()
    process.exit(1)
  })
