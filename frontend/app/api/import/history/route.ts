import { apiError, apiSuccess } from "@/lib/api-response";
import { isServiceError } from "@/lib/errors";
import { parseImportHistoryFilters } from "@/lib/import-history-filters";
import { listImportHistory, listLatestImportByManufacturer } from "@/services/import-history.service";

/**
 * GET /api/import/history
 *
 * Returns recent import history rows for the admin dashboard.
 * Query params:
 *   ?limit=50
 *   ?view=latest
 *   ?status=succeeded|partial|failed|running
 *   ?manufacturer=...
 *   ?trigger=cron|manual
 *   ?batchId=<scheduler_run_id>
 *   ?from=<iso-date>&to=<iso-date>
 *   ?preset=zero_products|updated_only
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(Number(limitParam), 1), 200) : 50;

  if (!Number.isFinite(limit)) {
    return apiError("Query param 'limit' must be a number.", 400, "INVALID_REQUEST");
  }

  const view = searchParams.get("view");

  try {
    if (view === "latest") {
      const history = await listLatestImportByManufacturer();
      return apiSuccess({ history });
    }

    const filters = parseImportHistoryFilters(searchParams);
    const history = await listImportHistory(limit, filters);
    return apiSuccess({ history, filters });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Query param")) {
      return apiError(error.message, 400, "INVALID_REQUEST");
    }

    if (isServiceError(error)) {
      return apiError(error.message, error.status, error.code);
    }

    const message =
      error instanceof Error ? error.message : "Failed to load import history";
    return apiError(message, 500, "IMPORT_HISTORY_ERROR");
  }
}
