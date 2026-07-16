import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isServiceError } from "@/lib/errors";
import { runScheduledImports } from "@/services/import-scheduler.service";

/**
 * POST /api/import/scheduler/run-now
 *
 * Starts an immediate scheduled import for all manufacturers in the dynamic
 * import queue (enabled=true, auto_import=true) in the background so the admin
 * UI can poll live progress.
 */
export async function POST(_request: NextRequest) {
  try {
    const outcome = await runScheduledImports({
      trigger: "manual",
      force: true,
      background: true,
    });

    if (outcome.skipped && outcome.skipReason === "no_manufacturers") {
      return apiError(
        "No manufacturers are configured for automatic import. Add rows to the manufacturers table with enabled=true and auto_import=true.",
        400,
        "IMPORT_QUEUE_EMPTY",
      );
    }

    if (outcome.skipped && outcome.skipReason === "already_running") {
      return apiError(
        "An import is already running. Wait for it to finish before starting another.",
        409,
        "IMPORT_ALREADY_RUNNING",
      );
    }

    return apiSuccess({
      ...outcome,
      message:
        "Import started. Poll GET /api/import/scheduler for live progress.",
    });
  } catch (error) {
    if (isServiceError(error)) {
      return apiError(error.message, error.status, error.code);
    }

    const message =
      error instanceof Error ? error.message : "Manual scheduled import failed";
    return apiError(message, 500, "SCHEDULED_IMPORT_ERROR");
  }
}
