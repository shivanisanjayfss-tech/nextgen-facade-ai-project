import { apiError, apiSuccess } from "@/lib/api-response";
import { isServiceError } from "@/lib/errors";
import { getImportBatchDetail } from "@/services/import-analytics.service";

interface RouteContext {
  params: Promise<{ batchId: string }>;
}

/**
 * GET /api/import/history/batches/[batchId]
 *
 * Returns a scheduler batch with linked manufacturer runs and stage events.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { batchId } = await context.params;

  if (!batchId?.trim()) {
    return apiError("Batch id is required.", 400, "INVALID_REQUEST");
  }

  try {
    const batch = await getImportBatchDetail(batchId);

    if (!batch) {
      return apiError("Import batch not found.", 404, "IMPORT_BATCH_NOT_FOUND");
    }

    return apiSuccess(batch);
  } catch (error) {
    if (isServiceError(error)) {
      return apiError(error.message, error.status, error.code);
    }

    const message =
      error instanceof Error ? error.message : "Failed to load import batch";
    return apiError(message, 500, "IMPORT_BATCH_ERROR");
  }
}
