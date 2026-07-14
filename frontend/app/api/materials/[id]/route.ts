import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api-response";
import { ServiceError } from "@/lib/errors";
import { mapMaterialToDetailResponse } from "@/lib/material-api";
import { requireMaterialById } from "@/services/material.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/materials/[id]
 *
 * Fetch a single material by UUID or slug.
 */
export const GET = withApiHandler(async (
  _request: NextRequest,
  context?: RouteContext,
) => {
  const { id } = await context!.params;
  const material = await requireMaterialById(id);
  return apiSuccess(mapMaterialToDetailResponse(material));
});
