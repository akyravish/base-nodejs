import jwt from 'jsonwebtoken'

import { hashPassword } from '../lib/crypto.js'
import { prisma } from '../lib/prisma.js'
import { RegisterSchema } from '../schemas/auth.schema.js'
import { ConflictError } from '../types/errors.js'
import { env } from '../lib/env.js'

/**
 * Register a new user and queue email verification
 * @param input - { email: string, password: string }
 * @returns { userId: string }
 */
export async function registerUser(
  input: RegisterSchema,
  options: { ipAddress?: string; userAgent?: string } = {},
): Promise<{ userId: string }> {
  const existingUser = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
  })

  if (existingUser) {
    throw new ConflictError('A user with this email already exists')
  }

  const passwordHash = await hashPassword(input.password)

  // Start a transaction
  const { user } = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email: input.email,
        passwordHash: passwordHash,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: newUser.id,
        action: 'user.registered',
        ipAddress: options.ipAddress ?? '',
        userAgent: options.userAgent ?? '',
        metadata: {
          email: newUser.email,
        },
      },
    })

    return { user: newUser }
  })

  return { userId: user.id }
}

/**
 * Generate a signed email verification token(JWT) for the user. We don't store this token - token itself is the proof. It expires in 24 hours.
 */
export function generateEmailVerificationToken(userId: string): string {
  return jwt.sign({ userId, purpose: 'email-verification' }, env.JWT_ACCESS_SECRET, {
    expiresIn: '24h',
  })
}
