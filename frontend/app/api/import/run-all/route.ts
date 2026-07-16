import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isImportCronAuthorized } from "@/lib/import-auth";
import { runScheduledImports } from "@/services/import-scheduler.service";

/**
 * POST /api/import/run-all
 * GET  /api/import/run-all  (Vercel Cron — monthly on the 1st at 02:00 UTC)
 *
 * Imports every manufacturer in the dynamic import queue sequentially via the
 * monthly scheduler.
 * Callable by Vercel Cron, n8n, or any HTTP client without UI.
 *
 * Optional auth (when IMPORT_CRON_SECRET is set):
 *   Authorization: Bearer <secret>
 *   x-cron-secret: <secret>
 *   ?secret=<secret>
 */
async function handleRunAll(request: NextRequest) {
  if (!isImportCronAuthorized(request)) {
    return apiError("Unauthorized.", 401, "UNAUTHORIZED");
  }

  try {
    const outcome = await runScheduledImports({ trigger: "cron" });

    if (outcome.skipped && outcome.skipReason === "no_manufacturers") {
      return apiSuccess({
        skipped: true,
        message:
          "No manufacturers are configured for automatic import (enabled=true, auto_import=true).",
        scheduler: outcome,
      });
    }

    if (outcome.skipped && outcome.skipReason === "disabled") {
      return apiSuccess({
        skipped: true,
        message: "Import scheduler is disabled.",
        scheduler: outcome,
      });
    }

    if (outcome.skipped && outcome.skipReason === "already_running") {
      return apiError(
        "Import already in progress.",
        409,
        "IMPORT_ALREADY_RUNNING",
      );
    }

    return apiSuccess(outcome);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scheduled import failed";
    return apiError(message, 500, "SCHEDULED_IMPORT_ERROR");
  }
}

export async function POST(request: NextRequest) {
  return handleRunAll(request);
}

export async function GET(request: NextRequest) {
  return handleRunAll(request);
}
