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

  /* ---------------------------------- SECURITY ---------------------------------- */
  ALLOWED_ORIGINS: z.string().transform((val) => val.split(',').map((origin) => origin.trim())),
  /** When true, Express trusts X-Forwarded-For (e.g. one reverse proxy). Sets req.ip for rate limits. */
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((val) => val === 'true' || val === '1'),

  /* ------------------------------ RATE LIMITING ----------------------------- */
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 900_000)),
  RATE_LIMIT_MAX: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 100)),

  /* ------------------------------ LOGGING ----------------------------- */
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
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
