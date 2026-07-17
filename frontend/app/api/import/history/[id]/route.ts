import { apiError, apiSuccess } from "@/lib/api-response";
import { isServiceError } from "@/lib/errors";
import { getImportHistoryDetail } from "@/services/import-analytics.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/import/history/[id]
 *
 * Returns a single import run with per-product decisions for auditing.
 * Query params: ?includeEvents=true — attaches import_run_events timeline.
 */
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;

  if (!id?.trim()) {
    return apiError("Import history id is required.", 400, "INVALID_REQUEST");
  }

  const includeEvents =
    new URL(request.url).searchParams.get("includeEvents") === "true";

  try {
    const detail = await getImportHistoryDetail(id, includeEvents);

    if (!detail) {
      return apiError("Import run not found.", 404, "IMPORT_HISTORY_NOT_FOUND");
    }

    if (includeEvents) {
      return apiSuccess({ run: detail.run, events: detail.events });
    }

    return apiSuccess({ run: detail.run });
  } catch (error) {
    if (isServiceError(error)) {
      return apiError(error.message, error.status, error.code);
    }

    const message =
      error instanceof Error ? error.message : "Failed to load import run";
    return apiError(message, 500, "IMPORT_HISTORY_ERROR");
  }
}
