export class AppError extends Error {
  readonly statusCode: number
  readonly isOperational: boolean
  readonly code: string

  constructor(message: string, statusCode: number, code: string) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.code = code
    this.isOperational = true
  }

  static badRequest(message: string): AppError {
    return new AppError(message, 400, 'BAD_REQUEST')
  }

  static unauthorized(message: string): AppError {
    return new AppError(message, 401, 'UNAUTHORIZED')
  }

  static notFound(message: string): AppError {
    return new AppError(message, 404, 'NOT_FOUND')
  }

  static internal(message: string): AppError {
    return new AppError(message, 500, 'INTERNAL_ERROR')
  }
}

export class ValidationError extends AppError {
  readonly details?: unknown

  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR')
    this.details = details
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND')
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT')
  }
}
