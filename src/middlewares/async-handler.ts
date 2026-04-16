import type { Request, RequestHandler, Response, NextFunction } from 'express'

// Wraps an async route handler in a try-catch block and passes errors to the error handler. Eliminates the need for try-catch blocks in route handlers.
// Usage: router.get('/me', asyncHandler(UserController.getMe))
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next)
  }
}
