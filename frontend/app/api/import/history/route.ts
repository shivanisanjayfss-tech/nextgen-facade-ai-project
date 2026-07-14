import { apiError, apiSuccess } from "@/lib/api-response";
import { isServiceError } from "@/lib/errors";
import { listImportHistory, listLatestImportByManufacturer } from "@/services/import-history.service";

/**
 * GET /api/import/history
 *
 * Returns recent import history rows for the admin dashboard.
 * Query params: ?limit=50
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
    const history =
      view === "latest"
        ? await listLatestImportByManufacturer()
        : await listImportHistory(limit);
    return apiSuccess({ history });
  } catch (error) {
    if (isServiceError(error)) {
      return apiError(error.message, error.status, error.code);
    }

    const message =
      error instanceof Error ? error.message : "Failed to load import history";
    return apiError(message, 500, "IMPORT_HISTORY_ERROR");
  }
}
