import jwt from 'jsonwebtoken'

import { buildVerificationEmailTemplate } from '../email-templates/verification-email.template.js'
import { hashPassword } from '../lib/crypto.js'
import { sendEmail } from '../lib/email.js'
import { env } from '../lib/env.js'
import { logger } from '../lib/logger.js'
import { prisma } from '../lib/prisma.js'
import { AUTH_MESSAGES } from '../messages/auth.messages.js'
import type { RegisterSchema } from '../schemas/auth.schema.js'
import { AuthError } from '../types/errors.js'

export type RegisterUserResult = { outcome: 'created'; userId: string } | { outcome: 'email_taken' }

export type RegisterAckPayload = {
  message: string
  verificationToken?: string
}

/**
 * Register a new user and queue email verification
 * @param input - { email: string, password: string }
 */
export async function registerUser(
  input: RegisterSchema,
  options: { ipAddress?: string; userAgent?: string } = {},
): Promise<RegisterUserResult> {
  const existingUser = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
  })

  if (existingUser) {
    return { outcome: 'email_taken' }
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

  return { outcome: 'created', userId: user.id }
}

/**
 * Generate a signed email verification token(JWT) for the user. We don't store this token - token itself is the proof. It expires in 24 hours.
 */
export function generateEmailVerificationToken(userId: string): string {
  return jwt.sign({ userId, purpose: 'email-verification' }, env.JWT_EMAIL_VERIFICATION_SECRET, {
    expiresIn: '24h',
  })
}

/**
 * Sends the registration verification email when PUBLIC_APP_URL is set.
 * The link uses a URL hash so the token is not sent to the server on initial navigation (only read by the SPA to POST to the API).
 */
export async function sendVerificationEmail(toEmail: string, token: string): Promise<void> {
  const publicAppUrl = env.PUBLIC_APP_URL
  if (!publicAppUrl) {
    logger.warn('PUBLIC_APP_URL is not set; verification email was not sent.')
    return
  }
  const baseUrl = publicAppUrl.replace(/\/$/, '')
  const verifyUrl = `${baseUrl}/verify-email#token=${encodeURIComponent(token)}`
  const { subject, html, text } = buildVerificationEmailTemplate(verifyUrl)
  await sendEmail({ to: toEmail, subject, text, html })
}

/**
 * Runs registration, optional dev token in payload, and best-effort verification email.
 */
export async function processRegistrationRequest(
  input: RegisterSchema,
  options: { ipAddress: string; userAgent: string; exposeVerificationToken: boolean },
): Promise<RegisterAckPayload> {
  const result = await registerUser(input, {
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
  })
  const data: RegisterAckPayload = { message: AUTH_MESSAGES.registerAck }
  if (result.outcome !== 'created') {
    return data
  }
  const verificationToken = generateEmailVerificationToken(result.userId)
  if (options.exposeVerificationToken) {
    data.verificationToken = verificationToken
  }
  try {
    await sendVerificationEmail(input.email, verificationToken)
  } catch (err: unknown) {
    logger.error('Failed to send verification email', {
      email: input.email,
      error: err instanceof Error ? err.message : String(err),
    })
  }
  return data
}

/**
 * Verify the email verification token and update the user's emailVerified field to true
 * @param token - The email verification token
 * @returns { void }
 */
export async function verifyEmail(token: string): Promise<void> {
  let payload: { userId: string; purpose: string }

  try {
    payload = jwt.verify(token, env.JWT_EMAIL_VERIFICATION_SECRET) as typeof payload
  } catch {
    throw new AuthError('Invalid or expired email verification token')
  }

  if (payload.purpose !== 'email-verification') {
    throw new AuthError('Invalid token purpose')
  }

  await prisma.user.update({
    where: { id: payload.userId },
    data: { emailVerified: true },
  })
}
