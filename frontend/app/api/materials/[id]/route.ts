import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api-response";
import { mapMaterialToDetailResponse } from "@/lib/material-api";
import {
  getManufacturerProductCount,
  getRelatedMaterials,
  requireMaterialById,
} from "@/services/material.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/materials/[id]
 *
 * Fetch a single material by UUID or slug with gallery, downloads, and related products.
 */
export const GET = withApiHandler(async (
  _request: NextRequest,
  context?: RouteContext,
) => {
  const { id } = await context!.params;
  const material = await requireMaterialById(id);

  const [relatedProducts, manufacturerProductCount] = await Promise.all([
    getRelatedMaterials(material),
    getManufacturerProductCount(material.manufacturer, material.sourceUrl),
  ]);

  return apiSuccess(
    mapMaterialToDetailResponse(material, {
      relatedProducts,
      manufacturerProductCount,
    }),
  );
});
