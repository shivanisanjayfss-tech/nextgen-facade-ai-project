import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isImportCronAuthorized } from "@/lib/import-auth";
import { runAllManufacturerImports } from "@/services/scheduled-import.service";

/**
 * POST /api/import/run-all
 * GET  /api/import/run-all  (Vercel Cron)
 *
 * Imports every configured manufacturer sequentially.
 * Callable by n8n, Vercel Cron, or any HTTP client without UI.
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
    const result = await runAllManufacturerImports();
    return apiSuccess(result);
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
