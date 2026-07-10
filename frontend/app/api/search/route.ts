import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api-response";
import { ServiceError } from "@/lib/errors";
import { searchMaterials } from "@/services/search.service";

/**
 * GET /api/search
 *
 * Search materials by query, category, and manufacturer.
 *   ?q=glass&category=Glass&page=1&limit=12
 */
export const GET = withApiHandler(async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const manufacturer = searchParams.get("manufacturer") ?? undefined;
  const page = Number(searchParams.get("page") ?? "1");
  const limit = Number(searchParams.get("limit") ?? "12");

  if (Number.isNaN(page) || page < 1) {
    throw new ServiceError("Invalid page parameter", "INVALID_REQUEST", 400);
  }

  if (Number.isNaN(limit) || limit < 1 || limit > 50) {
    throw new ServiceError("Limit must be between 1 and 50", "INVALID_REQUEST", 400);
  }

  const result = await searchMaterials({ q, category, manufacturer, page, limit });
  return apiSuccess(result);
});
