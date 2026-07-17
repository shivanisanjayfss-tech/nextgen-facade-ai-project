import { NextRequest } from "next/server";
import { apiError, apiSuccess, withApiHandler } from "@/lib/api-response";
import {
  getDatasheetIntelligenceByMaterialId,
  updateDatasheetManualReview,
} from "@/services/datasheet-intelligence.service";
import type { DatasheetExtractedFields } from "@/types/datasheet-intelligence";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ materialId: string }>;
}

/**
 * GET /api/datasheets/intelligence/[materialId]
 */
export const GET = withApiHandler(async (_request: NextRequest, context: RouteContext) => {
  const { materialId } = await context.params;

  if (!materialId?.trim()) {
    return apiError("Material id is required.", 400, "INVALID_REQUEST");
  }

  const intelligence = await getDatasheetIntelligenceByMaterialId(materialId.trim());
  if (!intelligence) {
    return apiError("Datasheet intelligence not found.", 404, "NOT_FOUND");
  }

  return apiSuccess(intelligence);
});

/**
 * PATCH /api/datasheets/intelligence/[materialId]
 *
 * Body: { manualOverrides: Partial<DatasheetExtractedFields> }
 */
export const PATCH = withApiHandler(async (request: NextRequest, context: RouteContext) => {
  const { materialId } = await context.params;

  if (!materialId?.trim()) {
    return apiError("Material id is required.", 400, "INVALID_REQUEST");
  }

  const body = (await request.json()) as {
    manualOverrides?: Partial<DatasheetExtractedFields>;
  };

  if (!body.manualOverrides || typeof body.manualOverrides !== "object") {
    return apiError("manualOverrides object is required.", 400, "INVALID_REQUEST");
  }

  const intelligence = await updateDatasheetManualReview(
    materialId.trim(),
    body.manualOverrides,
  );

  return apiSuccess(intelligence);
});
