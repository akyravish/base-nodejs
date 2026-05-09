// Augments the Express Request type to include our custom properties

declare global {
  namespace Express {
    interface Request {
      /** UUID assigned to every incoming request by the requestId middleware. */
      id?: string
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
