import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { compareMaterials } from "@/services/compare.service";

/** POST /api/compare — Compare 2–4 materials with optional AI summary. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const materialIds: string[] = body.materialIds;

    if (!Array.isArray(materialIds) || materialIds.length < 2) {
      return apiError("At least 2 material IDs are required", 400, "INVALID_REQUEST");
    }

    if (materialIds.length > 4) {
      return apiError("Maximum 4 materials can be compared", 400, "INVALID_REQUEST");
    }

    const result = await compareMaterials(materialIds);
    return apiSuccess(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Comparison failed";
    return apiError(message, 500, "COMPARE_ERROR");
  }
}
