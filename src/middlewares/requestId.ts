import { randomUUID } from 'crypto'
import type { NextFunction, Request, Response } from 'express'

/** Assigns a UUID to every request and echoes it in the X-Request-Id response header. */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = randomUUID()
  req.id = id
  res.setHeader('X-Request-Id', id)
  next()
}
