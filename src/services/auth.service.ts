import jwt from 'jsonwebtoken'
import type ms from 'ms'

import {
  buildPasswordResetEmailTemplate,
  buildVerificationEmailTemplate,
} from '../email-templates/verification-email.template.js'
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

const FAILED_ATTEMPT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const LOCKOUT_THRESHOLD = 5 // Number of failed attempts to trigger lockout
const LOCKOUT_DURATION_MS = 30 * 60 * 1000 // 30 minutes

interface JwtAccessPayload {
  userId: string
  orgId?: string
  isAdmin: boolean
}

interface TokenPair {
  accessToken: string
  refreshToken: string
}

export type RegisterUserResult = { outcome: 'created'; userId: string } | { outcome: 'email_taken' }

export type RegisterAckPayload = {
  message: string
  verificationToken?: string
}

/* ---------------------------- Token Generation ---------------------------- */

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

/* ------------------------- Account Lockout Checks ------------------------- */

/**
 * Check and handle account lockout
 * @param email - The user's email
 * @param ipAddress - The IP address of the request
 * @returns { void }
 */
async function checkAndHandleAccountLockout(email: string, ipAddress: string): Promise<void> {
  // Check user level lockout
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

  // Check IP level recent failed attempts
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

/**
 * Record a login attempt
 * @param userId - The user's ID
 * @param email - The user's email
 * @param success - Whether the login was successful
 * @param ipAddress - The IP address of the request
 * @returns { void }
 */
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

/* ----------------------------- Generate Tokens ---------------------------- */
/**
 * Generate a signed email verification token(JWT) for the user. We don't store this token - token itself is the proof. It expires in 24 hours.
 */
export function generateEmailVerificationToken(userId: string): string {
  return jwt.sign({ userId, purpose: 'email-verification' }, env.JWT_EMAIL_VERIFICATION_SECRET, {
    expiresIn: '24h',
  })
}

/**
 * Generate a signed password reset token(JWT) for the user. We don't store this token - token itself is the proof. It expires in 1 hour.
 */
export function generatePasswordResetToken(userId: string): string {
  return jwt.sign({ userId, purpose: 'password-reset' }, env.JWT_PASSWORD_RESET_SECRET, {
    expiresIn: '1h',
  })
}

/* ----------------------------- Send Emails ----------------------------- */
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
 * Sends the password reset email when PUBLIC_APP_URL is set.
 * The link uses a URL hash so the token is not sent to the server on initial navigation (only read by the SPA to POST to the API).
 */
export async function sendPasswordResetEmail(toEmail: string, token: string): Promise<void> {
  const publicAppUrl = env.PUBLIC_APP_URL
  if (!publicAppUrl) {
    logger.warn('PUBLIC_APP_URL is not set; password reset email was not sent.')
    return
  }
  const baseUrl = publicAppUrl.replace(/\/$/, '')
  const resetUrl = `${baseUrl}/reset-password#token=${encodeURIComponent(token)}`
  const { subject, html, text } = buildPasswordResetEmailTemplate(resetUrl)
  await sendEmail({ to: toEmail, subject, text, html })
}

/* ----------------------------- Auth Functions ----------------------------- */

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

/**
 * Login a user
 * @param input - { email: string, password: string }
 * @param options - { ipAddress: string, userAgent: string }
 * @returns { string } - The JWT token
 */
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

  // Reset lockout on successful login
  if (user.lockedUntil) {
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        lockedUntil: null,
      },
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
      metadata: {
        email,
        rememberMe,
      },
    },
  })

  return { accessToken, refreshToken }
}

/**
 * Revoke a refresh token
 * @param rawRefreshToken - The raw refresh token
 * @returns { void }
 */
export async function revokeRefreshToken(rawRefreshToken: string): Promise<void> {
  const tokenHash = hashToken(rawRefreshToken)

  await prisma.refreshToken.update({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

/**
 * Refresh an access token
 * @param rawRefreshToken - The raw refresh token
 * @param options - { ipAddress: string, userAgent: string }
 * @returns { string } - The new access token
 */
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

  // Rotate: revoke old refresh token and create new one
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

/**
 * Sends the password reset email when PUBLIC_APP_URL is set.
 * The link uses a URL hash so the token is not sent to the server on initial navigation (only read by the SPA to POST to the API).
 */
export async function passwordResetToken(userId: string, email: string): Promise<void> {
  const resetToken = generatePasswordResetToken(userId)

  try {
    await sendPasswordResetEmail(email, resetToken)
  } catch (err: unknown) {
    logger.error('Failed to send password reset email', {
      email,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

/**
 * Reset a user's password
 * @param input - { token: string, password: string }
 * @returns { void }
 */
export async function resetPassword(
  input: ResetPasswordSchema,
  options: { ipAddress: string; userAgent: string },
): Promise<void> {
  let payload: { userId: string; purpose: string }
  const { token, password } = input

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

export interface PublicSessionRow {
  id: string
  createdAt: Date
  expiresAt: Date
  /** Masked IP for display (reduces PII vs raw address). */
  ipLabel: string | null
  /** Truncated user-agent string for display. */
  clientLabel: string | null
}

function maskIpForSessionList(ip: string | null): string | null {
  if (ip == null || ip === '') {
    return null
  }
  if (ip.includes('.')) {
    const parts = ip.split('.')
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.x.x`
    }
  }
  if (ip.includes(':')) {
    return '[IPv6 masked]'
  }
  return '—'
}

const MAX_CLIENT_LABEL_LENGTH = 120

function truncateClientLabelForSessionList(ua: string | null): string | null {
  if (ua == null || ua === '') {
    return null
  }
  const t = ua.replace(/\s+/g, ' ').trim()
  if (t.length <= MAX_CLIENT_LABEL_LENGTH) {
    return t
  }
  return `${t.slice(0, MAX_CLIENT_LABEL_LENGTH - 1)}…`
}

/**
 * List a user's active sessions (public-safe fields: masked IP, truncated user agent).
 * @param userId - The user's ID
 */
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
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    ipLabel: maskIpForSessionList(r.ipAddress),
    clientLabel: truncateClientLabelForSessionList(r.userAgent),
  }))
}

/**
 * Revoke a session by ID
 * @param userId - The user's ID
 * @param sessionId - The session's ID
 * @returns { void }
 */
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
