import { apiError, apiSuccess } from "@/lib/api-response";
import { isServiceError } from "@/lib/errors";
import { repairAlucobondProductNames } from "@/services/alucobond-name-repair.service";

/**
 * POST /api/import/repair-alucobond-names
 *
 * Fixes Alucobond materials imported with generic website titles.
 * Updates existing rows by source_url — does not create duplicates.
 */
export async function POST() {
  try {
    const result = await repairAlucobondProductNames();
    return apiSuccess(result);
  } catch (error) {
    if (isServiceError(error)) {
      return apiError(error.message, error.status, error.code);
    }

    const message =
      error instanceof Error ? error.message : "Alucobond name repair failed";
    return apiError(message, 500, "ALUCOBOND_REPAIR_ERROR");
  }
}
