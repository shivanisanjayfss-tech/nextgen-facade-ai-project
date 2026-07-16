import { apiError, apiSuccess } from "@/lib/api-response";
import { isServiceError } from "@/lib/errors";
import { runSingleManufacturerImport } from "@/services/scheduled-import.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/import/manufacturers/[id]/run
 *
 * Runs a full import for a single manufacturer from the registry.
 */
export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const report = await runSingleManufacturerImport(id, {
      useFullImport: true,
    });

    return apiSuccess({ report });
  } catch (error) {
    if (isServiceError(error)) {
      return apiError(error.message, error.status, error.code);
    }

    const message =
      error instanceof Error ? error.message : "Manufacturer import failed";
    return apiError(message, 500, "MANUFACTURER_IMPORT_ERROR");
  }
}
