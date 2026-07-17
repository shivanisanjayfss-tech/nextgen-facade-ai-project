import { apiError, apiSuccess } from "@/lib/api-response";
import { isServiceError } from "@/lib/errors";
import { listImportBatchSummaries } from "@/services/import-analytics.service";

/**
 * GET /api/import/history/batches
 *
 * Lists scheduler batch runs (import_scheduler_runs), newest first.
 * Query params: ?limit=50
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(Number(limitParam), 1), 200) : 50;

  if (!Number.isFinite(limit)) {
    return apiError("Query param 'limit' must be a number.", 400, "INVALID_REQUEST");
  }

  try {
    const batches = await listImportBatchSummaries(limit);
    return apiSuccess({ batches });
  } catch (error) {
    if (isServiceError(error)) {
      return apiError(error.message, error.status, error.code);
    }

    const message =
      error instanceof Error ? error.message : "Failed to load import batches";
    return apiError(message, 500, "IMPORT_BATCHES_ERROR");
  }
}
