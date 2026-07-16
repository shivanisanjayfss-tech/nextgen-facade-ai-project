import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isServiceError } from "@/lib/errors";
import {
  getManufacturerRegistryStats,
  loadManufacturerProductCounts,
  resolveRegistryProductCount,
  syncManufacturerProductCounts,
} from "@/services/manufacturer-product-counts.service";
import {
  createManufacturerRegistry,
  searchManufacturerRegistry,
} from "@/services/manufacturer-registry.service";
import type { CreateManufacturerRegistryInput } from "@/types/manufacturer-registry";

/**
 * GET /api/import/manufacturers
 *
 * Returns manufacturer registry rows for the admin panel with optional search filters.
 * Includes live product-count stats. Zero-product manufacturers remain in the list.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const manufacturers = await searchManufacturerRegistry({
      q: searchParams.get("q") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      country: searchParams.get("country") ?? undefined,
      website: searchParams.get("website") ?? undefined,
    });

    const counts = await loadManufacturerProductCounts();
    const withLiveCounts = manufacturers.map((row) => ({
      ...row,
      total_products: resolveRegistryProductCount(row, counts),
    }));

    if (searchParams.get("syncCounts") !== "0") {
      await syncManufacturerProductCounts(withLiveCounts).catch(() => undefined);
    }

    const stats = await getManufacturerRegistryStats(withLiveCounts);

    return apiSuccess({ manufacturers: withLiveCounts, stats });
  } catch (error) {
    if (isServiceError(error)) {
      return apiError(error.message, error.status, error.code);
    }

    const message =
      error instanceof Error ? error.message : "Failed to load manufacturers";
    return apiError(message, 500, "MANUFACTURER_REGISTRY_ERROR");
  }
}

/**
 * POST /api/import/manufacturers
 *
 * Creates a manufacturer registry row for the admin panel.
 */
export async function POST(request: NextRequest) {
  let body: CreateManufacturerRegistryInput;

  try {
    body = (await request.json()) as CreateManufacturerRegistryInput;
  } catch {
    return apiError("Invalid JSON body.", 400, "INVALID_REQUEST");
  }

  try {
    const manufacturer = await createManufacturerRegistry(body);
    return apiSuccess({ manufacturer }, 201);
  } catch (error) {
    if (isServiceError(error)) {
      return apiError(error.message, error.status, error.code);
    }

    const message =
      error instanceof Error ? error.message : "Failed to create manufacturer";
    return apiError(message, 500, "MANUFACTURER_REGISTRY_CREATE_ERROR");
  }
}
