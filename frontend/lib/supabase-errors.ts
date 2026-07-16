import { ServiceError } from "@/lib/errors";

type SupabaseErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

/** Builds a full, non-empty message from a Supabase/PostgREST error payload. */
export function formatSupabaseError(
  error: SupabaseErrorLike | null | undefined,
  context?: string,
): string {
  if (!error) {
    return context ? `${context}: unknown database error` : "unknown database error";
  }

  const parts = [
    context,
    error.message?.trim(),
    error.code ? `code=${error.code}` : undefined,
    error.details ? `details=${error.details}` : undefined,
    error.hint ? `hint=${error.hint}` : undefined,
  ].filter((part): part is string => Boolean(part && part.length > 0));

  if (parts.length > 0) {
    return parts.join(" | ");
  }

  return JSON.stringify(error);
}

export function isMissingMaterialsIsActiveColumn(
  error: SupabaseErrorLike | null | undefined,
): boolean {
  const text = formatSupabaseError(error).toLowerCase();
  return text.includes("is_active") && text.includes("does not exist");
}

/** Logs and throws a ServiceError with the full database error message. */
export function raiseSupabaseError(
  error: SupabaseErrorLike | null | undefined,
  context: string,
): never {
  const message = formatSupabaseError(error, context);
  console.error(`[supabase] ${message}`);
  if (error && typeof error === "object") {
    console.error("[supabase] raw error:", error);
  }
  throw new ServiceError(message, "DATABASE_ERROR", 500);
}
