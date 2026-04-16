// Augments the Express Request type to include our custom properties

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        email: string
      }
    }
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    rateLimit?: {
      limit: number
      current: number
      remaining: number
      resetTime?: Date
    }
  }
}

export {}
