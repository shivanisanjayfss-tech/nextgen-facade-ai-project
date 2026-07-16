import { apiError, apiSuccess } from "@/lib/api-response";
import { isServiceError } from "@/lib/errors";
import { updateManufacturerRegistry } from "@/services/manufacturer-registry.service";
import type { UpdateManufacturerRegistryInput } from "@/types/manufacturer-registry";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/import/manufacturers/[id]
 *
 * Updates manufacturer registry configuration (enabled, auto_import, strategy, etc.).
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  let body: UpdateManufacturerRegistryInput;
  try {
    body = (await request.json()) as UpdateManufacturerRegistryInput;
  } catch {
    return apiError("Invalid JSON body.", 400, "INVALID_REQUEST");
  }

  try {
    const manufacturer = await updateManufacturerRegistry(id, body);
    return apiSuccess({ manufacturer });
  } catch (error) {
    if (isServiceError(error)) {
      return apiError(error.message, error.status, error.code);
    }

    const message =
      error instanceof Error ? error.message : "Failed to update manufacturer";
    return apiError(message, 500, "MANUFACTURER_REGISTRY_UPDATE_ERROR");
  }
}
