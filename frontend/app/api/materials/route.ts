import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api-response";
import { ServiceError } from "@/lib/errors";
import { mapMaterialToDetailResponse } from "@/lib/material-api";
import { normalizePagination } from "@/lib/pagination";
import { getAllMaterials, getMaterialById } from "@/services/material.service";

/**
 * GET /api/materials
 *
 * List materials with optional filters:
 *   ?category=ACP%20Sheet&page=1&limit=20
 *
 * Fetch a single material:
 *   ?id=<uuid-or-slug>
 */
export const GET = withApiHandler(async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get("id");

  if (id) {
    const material = await getMaterialById(id);
    if (!material) {
      throw new ServiceError(`Material "${id}" not found`, "NOT_FOUND", 404);
    }
    return apiSuccess(mapMaterialToDetailResponse(material));
  }

  const category = searchParams.get("category") ?? undefined;
  const rawPage = Number(searchParams.get("page") ?? "1");
  const rawLimit = Number(searchParams.get("limit") ?? "20");
  const { page, limit } = normalizePagination(rawPage, rawLimit, 50);

  const result = await getAllMaterials({ category, page, limit });
  return apiSuccess(result);
});
