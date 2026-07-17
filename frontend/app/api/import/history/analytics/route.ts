import { apiError, apiSuccess } from "@/lib/api-response";
import { isServiceError } from "@/lib/errors";
import { parseImportHistoryFilters } from "@/lib/import-history-filters";
import { getImportHistoryAnalytics } from "@/services/import-analytics.service";

/**
 * GET /api/import/history/analytics
 *
 * Returns aggregated import metrics over an optional filtered history set.
 * Query params: status, manufacturer, trigger, batchId, from, to, preset
 */
export async function GET(request: Request) {
  try {
    const filters = parseImportHistoryFilters(new URL(request.url).searchParams);
    const analytics = await getImportHistoryAnalytics(filters);
    return apiSuccess({ analytics });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Query param")) {
      return apiError(error.message, 400, "INVALID_REQUEST");
    }

    if (isServiceError(error)) {
      return apiError(error.message, error.status, error.code);
    }

    const message =
      error instanceof Error ? error.message : "Failed to load import analytics";
    return apiError(message, 500, "IMPORT_ANALYTICS_ERROR");
  }
}
