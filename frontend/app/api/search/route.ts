import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api-response";
import { normalizePagination } from "@/lib/pagination";
import { logAnalyticsEvent } from "@/services/analytics.service";
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
  const manufacturerId = searchParams.get("manufacturerId") ?? undefined;

  const rawPage = Number(searchParams.get("page") ?? "1");
  const rawLimit = Number(searchParams.get("limit") ?? "12");
  const { page, limit } = normalizePagination(rawPage, rawLimit, 50);

  const result = await searchMaterials({
    q,
    category,
    manufacturer,
    manufacturerId,
    page,
    limit,
  });

  void logAnalyticsEvent({
    eventName: "search",
    metadata: {
      q: q ?? "",
      category: category ?? "",
      manufacturer: manufacturer ?? "",
      manufacturerId: manufacturerId ?? "",
      resultCount: result.total,
    },
  });

  return apiSuccess(result);
});
