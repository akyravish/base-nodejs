import jwt from 'jsonwebtoken'
import type ms from 'ms'

import {
  buildPasswordResetEmailTemplate,
  buildVerificationEmailTemplate,
} from '../email-templates/verification-email.template.js'
import {
  getPublicAppBaseUrl,
  mapSessionRowsToPublicRows,
  type PublicSessionRow,
} from '../lib/auth-helpers.js'
import {
  DUMMY_PASSWORD_VERIFICATION_HASH,
  generateSecureToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from '../lib/crypto.js'
import { sendEmail } from '../lib/email.js'
import { env } from '../lib/env.js'
import { logger } from '../lib/logger.js'
import { prisma } from '../lib/prisma.js'
import { AUTH_MESSAGES } from '../messages/auth.messages.js'
import type { LoginSchema, RegisterSchema, ResetPasswordSchema } from '../schemas/auth.schema.js'
import { AuthError, NotFoundError, RateLimitError } from '../types/errors.js'

/* ---------------------------------- Types ---------------------------------- */

export interface JwtAccessPayload {
  userId: string
  orgId?: string
  isAdmin: boolean
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export type RegisterUserResult = { outcome: 'created'; userId: string } | { outcome: 'email_taken' }

export type RegisterAckPayload = {
  message: string
  verificationToken?: string
}

export type { PublicSessionRow }

/* --------------------------- Login lockout (internal) --------------------------- */

const FAILED_ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const LOCKOUT_THRESHOLD = 5
const LOCKOUT_DURATION_MS = 30 * 60 * 1000

async function checkAndHandleAccountLockout(email: string, ipAddress: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { lockedUntil: true },
  })
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const retryAfterSeconds = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000)
    throw new RateLimitError(
      `Account is locked. Please try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`,
    )
  }
  if (ipAddress) {
    const recentFailedAttempts = await prisma.loginAttempt.count({
      where: {
        ipAddress,
        email,
        success: false,
        attemptAt: { gte: new Date(Date.now() - FAILED_ATTEMPT_WINDOW_MS) },
      },
    })
    if (recentFailedAttempts >= LOCKOUT_THRESHOLD * 2) {
      throw new RateLimitError('Too many failed attempts from this IP. Try again later.')
    }
  }
}

async function recordLoginAttempt(
  userId: string | null,
  email: string,
  success: boolean,
  ipAddress: string | undefined,
): Promise<void> {
  await prisma.loginAttempt.create({
    data: {
      userId,
      email,
      success,
      ipAddress: ipAddress ?? '',
      attemptAt: new Date(),
    },
  })
  if (!success && userId) {
    const recentFailedAttempts = await prisma.loginAttempt.count({
      where: {
        userId,
        success: false,
        attemptAt: { gte: new Date(Date.now() - FAILED_ATTEMPT_WINDOW_MS) },
      },
    })
    if (recentFailedAttempts >= LOCKOUT_THRESHOLD) {
      await prisma.user.update({
        where: { id: userId },
        data: { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) },
      })
    }
  }
}

/* ----------------------------- JWT & refresh storage ----------------------------- */

function generateAccessToken(payload: JwtAccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY as ms.StringValue,
  })
}

async function createRefreshToken(
  userId: string,
  options: { rememberMe?: boolean; ipAddress?: string; userAgent?: string },
): Promise<string> {
  const rawToken = generateSecureToken(64)
  const tokenHash = hashToken(rawToken)
  const expiryDays = options.rememberMe ? 30 : 7
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
      ipAddress: options.ipAddress ?? '',
      userAgent: options.userAgent ?? '',
    },
  })
  return rawToken
}

export function generateEmailVerificationToken(userId: string): string {
  return jwt.sign({ userId, purpose: 'email-verification' }, env.JWT_EMAIL_VERIFICATION_SECRET, {
    expiresIn: '24h',
  })
}

export function generatePasswordResetToken(userId: string): string {
  return jwt.sign({ userId, purpose: 'password-reset' }, env.JWT_PASSWORD_RESET_SECRET, {
    expiresIn: '1h',
  })
}

/* --------------------------------- Email --------------------------------- */

function logEmailSendFailure(context: string, toEmail: string, err: unknown): void {
  logger.error(context, {
    email: toEmail,
    error: err instanceof Error ? err.message : String(err),
  })
}

export async function sendVerificationEmail(toEmail: string, token: string): Promise<void> {
  const baseUrl = getPublicAppBaseUrl()
  if (!baseUrl) {
    logger.warn('PUBLIC_APP_URL is not set; verification email was not sent.')
    return
  }
  const verifyUrl = `${baseUrl}/verify-email#token=${encodeURIComponent(token)}`
  const { subject, html, text } = buildVerificationEmailTemplate(verifyUrl)
  await sendEmail({ to: toEmail, subject, text, html })
}

export async function sendPasswordResetEmail(toEmail: string, token: string): Promise<void> {
  const baseUrl = getPublicAppBaseUrl()
  if (!baseUrl) {
    logger.warn('PUBLIC_APP_URL is not set; password reset email was not sent.')
    return
  }
  const resetUrl = `${baseUrl}/reset-password#token=${encodeURIComponent(token)}`
  const { subject, html, text } = buildPasswordResetEmailTemplate(resetUrl)
  await sendEmail({ to: toEmail, subject, text, html })
}

/* ----------------------------- Registration ----------------------------- */

export async function registerUser(
  input: RegisterSchema,
  options: { ipAddress?: string; userAgent?: string } = {},
): Promise<RegisterUserResult> {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  })
  if (existingUser) {
    return { outcome: 'email_taken' }
  }
  const passwordHash = await hashPassword(input.password)
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
        metadata: { email: newUser.email },
      },
    })
    return { user: newUser }
  })
  return { outcome: 'created', userId: user.id }
}

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
    logEmailSendFailure('Failed to send verification email', input.email, err)
  }
  return data
}

/* -------------------------- Verify, login, password -------------------------- */

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

export async function loginUser(
  input: LoginSchema,
  options: { ipAddress: string; userAgent: string },
): Promise<TokenPair> {
  const { email, password, rememberMe } = input
  const { ipAddress, userAgent } = options
  await checkAndHandleAccountLockout(email, ipAddress)
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, lockedUntil: true, emailVerified: true },
  })
  const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_VERIFICATION_HASH
  const isPasswordValid = await verifyPassword(password, passwordHash)
  if (!user || !isPasswordValid) {
    await recordLoginAttempt(user?.id ?? null, email, false, ipAddress)
    throw new AuthError('Invalid email or password')
  }
  if (!user.emailVerified) {
    await recordLoginAttempt(user.id, email, false, ipAddress)
    throw new AuthError('Invalid email or password')
  }
  await recordLoginAttempt(user?.id ?? null, email, true, ipAddress)
  if (user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { lockedUntil: null },
    })
  }
  const accessToken = generateAccessToken({ userId: user.id, isAdmin: false })
  const refreshToken = await createRefreshToken(user.id, {
    rememberMe,
    ipAddress,
    userAgent: userAgent,
  })
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'user.login',
      ipAddress,
      userAgent: userAgent,
      metadata: { email, rememberMe },
    },
  })
  return { accessToken, refreshToken }
}

export async function passwordResetToken(userId: string, email: string): Promise<void> {
  const resetToken = generatePasswordResetToken(userId)
  try {
    await sendPasswordResetEmail(email, resetToken)
  } catch (err: unknown) {
    logEmailSendFailure('Failed to send password reset email', email, err)
  }
}

export async function resetPassword(
  input: ResetPasswordSchema,
  options: { ipAddress: string; userAgent: string },
): Promise<void> {
  const { token, password } = input
  let payload: { userId: string; purpose: string }
  try {
    payload = jwt.verify(token, env.JWT_PASSWORD_RESET_SECRET) as typeof payload
  } catch {
    throw new AuthError('Invalid or expired password reset link')
  }
  if (payload.purpose !== 'password-reset') {
    throw new AuthError('Invalid token purpose')
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true },
  })
  if (!user) {
    throw new AuthError('Invalid or expired password reset link')
  }
  const newPasswordHash = await hashPassword(password)
  await prisma.$transaction([
    prisma.user.update({
      where: { id: payload.userId },
      data: { passwordHash: newPasswordHash },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: payload.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'user.password_reset',
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
      },
    }),
  ])
}

/* --------------------------- Sessions (refresh) --------------------------- */

export async function revokeRefreshToken(rawRefreshToken: string): Promise<void> {
  const tokenHash = hashToken(rawRefreshToken)
  await prisma.refreshToken.update({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export async function refreshAccessToken(
  rawRefreshToken: string,
  options: { ipAddress: string; userAgent: string },
): Promise<TokenPair> {
  const tokenHash = hashToken(rawRefreshToken)
  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  })
  if (!storedToken || storedToken.revokedAt !== null || storedToken.expiresAt < new Date()) {
    throw new AuthError('Invalid or expired refresh token')
  }
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revokedAt: new Date() },
  })
  const accessToken = generateAccessToken({ userId: storedToken.user.id, isAdmin: false })
  const newRefreshToken = await createRefreshToken(storedToken.user.id, {
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
  })
  return { accessToken, refreshToken: newRefreshToken }
}

export async function listUserSessions(userId: string): Promise<PublicSessionRow[]> {
  const rows = await prisma.refreshToken.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, ipAddress: true, userAgent: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return mapSessionRowsToPublicRows(rows)
}

export async function revokeSessionById(userId: string, sessionId: string): Promise<void> {
  const session = await prisma.refreshToken.findUnique({ where: { id: sessionId } })
  if (!session || session.userId !== userId) {
    throw new NotFoundError('Session not found')
  }
  await prisma.refreshToken.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  })
}
