import { apiError, apiSuccess } from "@/lib/api-response";
import { isServiceError } from "@/lib/errors";
import { getImportHistoryById } from "@/services/import-history.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/import/history/[id]
 *
 * Returns a single import run with per-product decisions for auditing.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  if (!id?.trim()) {
    return apiError("Import history id is required.", 400, "INVALID_REQUEST");
  }

  try {
    const run = await getImportHistoryById(id);

    if (!run) {
      return apiError("Import run not found.", 404, "IMPORT_HISTORY_NOT_FOUND");
    }

    return apiSuccess({ run });
  } catch (error) {
    if (isServiceError(error)) {
      return apiError(error.message, error.status, error.code);
    }

    const message =
      error instanceof Error ? error.message : "Failed to load import run";
    return apiError(message, 500, "IMPORT_HISTORY_ERROR");
  }
}
