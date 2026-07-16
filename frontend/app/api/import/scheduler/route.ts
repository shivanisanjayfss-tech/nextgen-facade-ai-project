import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isServiceError } from "@/lib/errors";
import {
  getImportSchedulerStatus,
  setSchedulerEnabled,
} from "@/services/import-scheduler-settings.service";

/**
 * GET /api/import/scheduler
 *
 * Returns scheduler status for the admin import page.
 */
export async function GET() {
  try {
    const status = await getImportSchedulerStatus();
    return apiSuccess({ scheduler: status });
  } catch (error) {
    if (isServiceError(error)) {
      return apiError(error.message, error.status, error.code);
    }

    const message =
      error instanceof Error ? error.message : "Failed to load scheduler status";
    return apiError(message, 500, "IMPORT_SCHEDULER_ERROR");
  }
}

/**
 * PATCH /api/import/scheduler
 *
 * Body: { "enabled": true | false }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as { enabled?: boolean };

    if (typeof body.enabled !== "boolean") {
      return apiError(
        "Request body must include boolean 'enabled'.",
        400,
        "INVALID_REQUEST",
      );
    }

    await setSchedulerEnabled(body.enabled);
    const status = await getImportSchedulerStatus();
    return apiSuccess({ scheduler: status });
  } catch (error) {
    if (isServiceError(error)) {
      return apiError(error.message, error.status, error.code);
    }

    const message =
      error instanceof Error ? error.message : "Failed to update scheduler";
    return apiError(message, 500, "IMPORT_SCHEDULER_ERROR");
  }
}
