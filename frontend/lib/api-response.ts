import { NextResponse, type NextRequest } from "next/server";
import { getErrorCode, getErrorMessage, getErrorStatus } from "@/lib/errors";
import type { ApiError, ApiSuccess } from "@/types";

export function apiSuccess<T>(data: T, status = 200) {
  const body: ApiSuccess<T> = { success: true, data };
  return NextResponse.json(body, { status });
}

export function apiError(message: string, status = 500, code?: string) {
  const body: ApiError = { success: false, error: { message, code } };
  return NextResponse.json(body, { status });
}

/** Converts a caught error into a standardized JSON error response. */
export function handleApiError(error: unknown) {
  const message = getErrorMessage(error) || "An unexpected error occurred";
  const status = getErrorStatus(error);
  const code = getErrorCode(error);
  return apiError(message, status, code);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (request: NextRequest, context?: any) => Promise<NextResponse>;

/** Wraps an API route handler with centralized try/catch error handling. */
export function withApiHandler(handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error("[api] Unhandled route error:", error);
      if (error instanceof Error && error.stack) {
        console.error("[api] Stack trace:\n", error.stack);
      }
      return handleApiError(error);
    }
  };
}
