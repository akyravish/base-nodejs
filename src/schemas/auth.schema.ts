import { z } from 'zod'

/** Upper bound for JWTs and similar tokens in request bodies (DoS / abuse cap). */
const MAX_TOKEN_STRING_LENGTH = 8192

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')

export const registerSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  password: passwordSchema,
})

const loginPasswordSchema = z
  .string()
  .min(1, 'Password is required')
  .max(1024, 'Password is too long')

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  password: loginPasswordSchema,
  rememberMe: z.boolean().optional().default(false),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required').max(MAX_TOKEN_STRING_LENGTH, 'Token is too long'),
  password: passwordSchema,
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
})

export const verifyEmailSchema = z.object({
  token: z
    .string()
    .min(1, 'Verification token is required')
    .max(MAX_TOKEN_STRING_LENGTH, 'Token is too long'),
})

export type RegisterSchema = z.infer<typeof registerSchema>
export type LoginSchema = z.infer<typeof loginSchema>
export type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>
export type ChangePasswordSchema = z.infer<typeof changePasswordSchema>
export type VerifyEmailSchema = z.infer<typeof verifyEmailSchema>
