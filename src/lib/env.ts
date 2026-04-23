import { config } from 'dotenv'
import { z } from 'zod'

config()

const envSchema = z.object({
  /* ---------------------------------- CORS ---------------------------------- */
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  /* ---------------------------------- DATABASE ---------------------------------- */
  DATABASE_URL: z.string().min(1).url(),
  DATABASE_POOL_MIN: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 2)),
  DATABASE_POOL_MAX: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 10)),

  /* ---------------------------------- REDIS ---------------------------------- */
  REDIS_URL: z.string().min(1).url(),

  /* ---------------------------------- JWT ---------------------------------- */
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters long'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long'),
  JWT_EMAIL_VERIFICATION_SECRET: z
    .string()
    .min(32, 'JWT_EMAIL_VERIFICATION_SECRET must be at least 32 characters long'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  /* ---------------------------------- SECURITY ---------------------------------- */
  ALLOWED_ORIGINS: z.string().transform((val) => val.split(',').map((origin) => origin.trim())),
  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be a 64-char hex string (32 bytes)'),

  /* ------------------------------ RATE LIMITING ----------------------------- */
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 900_000)),
  RATE_LIMIT_MAX: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 100)),

  /* ------------------------------ EMAIL ----------------------------- */
  /** Base URL of the web app (e.g. https://app.example.com). Used to build verify-email links; omit trailing slash. */
  PUBLIC_APP_URL: z.string().url().optional(),
  EMAIL_FROM: z.string().email().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 587)),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
})

function parseEnv(): z.infer<typeof envSchema> {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const missingOrInvalid = result.error.errors.map(
      (err) => `  - ${err.path.join('.')}: ${err.message}`,
    )

    console.error('\n❌ Environment variable validation failed:')
    console.error(missingOrInvalid.join('\n'))
    console.error('\nCheck your .env file against .env.example\n')

    process.exit(1)
  }

  return result.data
}

export const env = parseEnv()
export type Env = z.infer<typeof envSchema>
