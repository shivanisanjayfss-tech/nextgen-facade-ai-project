import { apiError, apiSuccess } from "@/lib/api-response";
import { isServiceError } from "@/lib/errors";
import { repairManufacturerCatalog } from "@/services/manufacturer-catalog-repair.service";

/**
 * POST /api/import/repair-manufacturer-catalog
 *
 * Merges legacy Alucobond manufacturer labels into 3A Composites and sets brand = ALUCOBOND.
 * Removes mock demo rows that duplicate imported catalogue products.
 */
export async function POST() {
  try {
    const result = await repairManufacturerCatalog();
    return apiSuccess(result);
  } catch (error) {
    if (isServiceError(error)) {
      return apiError(error.message, error.status, error.code);
    }

    const message =
      error instanceof Error ? error.message : "Manufacturer catalogue repair failed";
    return apiError(message, 500, "MANUFACTURER_CATALOG_REPAIR_ERROR");
  }
}
