import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api-response";
import { normalizePagination } from "@/lib/pagination";
import { searchDatasheetIntelligence } from "@/services/datasheet-intelligence.service";

/**
 * GET /api/datasheets/intelligence/search
 *
 * Search by datasheet intelligence facets and keywords.
 */
export const GET = withApiHandler(async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const rawPage = Number(searchParams.get("page") ?? "1");
  const rawLimit = Number(searchParams.get("limit") ?? "12");
  const { page, limit } = normalizePagination(rawPage, rawLimit, 50);

  const result = await searchDatasheetIntelligence({
    q: searchParams.get("q") ?? undefined,
    fireRating: searchParams.get("fireRating") ?? undefined,
    thickness: searchParams.get("thickness") ?? undefined,
    finish: searchParams.get("finish") ?? undefined,
    manufacturer: searchParams.get("manufacturer") ?? undefined,
    manufacturerId: searchParams.get("manufacturerId") ?? undefined,
    thermalValue: searchParams.get("thermalValue") ?? undefined,
    certification: searchParams.get("certification") ?? undefined,
    page,
    limit,
  });

  return apiSuccess(result);
});
