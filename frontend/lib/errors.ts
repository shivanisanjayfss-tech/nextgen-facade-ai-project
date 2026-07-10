/** Structured error thrown by service layer — caught by API route handlers. */
export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 500,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError;
}

/** Converts unknown errors into a safe message string for API responses. */
export function getErrorMessage(error: unknown, fallback = "An unexpected error occurred"): string {
  if (error instanceof ServiceError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function getErrorStatus(error: unknown): number {
  if (error instanceof ServiceError) return error.status;
  return 500;
}

export function getErrorCode(error: unknown): string {
  if (error instanceof ServiceError) return error.code;
  return "INTERNAL_ERROR";
}
