import { apiError, apiSuccess } from "@/lib/api-response";
import { isServiceError } from "@/lib/errors";
import { repairProductImageUrls } from "@/services/material-image-repair.service";

/**
 * POST /api/import/repair-product-images
 *
 * Normalizes stored image_url values and backfills from gallery images.
 * Never clears existing image_url values.
 */
export async function POST() {
  try {
    const result = await repairProductImageUrls();
    return apiSuccess(result);
  } catch (error) {
    if (isServiceError(error)) {
      return apiError(error.message, error.status, error.code);
    }

    const message =
      error instanceof Error ? error.message : "Product image repair failed";
    return apiError(message, 500, "PRODUCT_IMAGE_REPAIR_ERROR");
  }
}
