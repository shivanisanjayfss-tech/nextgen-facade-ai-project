import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api-response";
import { listDatasheetIntelligenceForReview } from "@/services/datasheet-intelligence.service";
import type { DatasheetIntelligenceStatus } from "@/types/datasheet-intelligence";

/**
 * GET /api/datasheets/intelligence/review
 *
 * Lists datasheet intelligence rows for admin review.
 */
export const GET = withApiHandler(async (request: NextRequest) => {
  const status = request.nextUrl.searchParams.get("status") as
    | DatasheetIntelligenceStatus
    | null;
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "50");

  const items = await listDatasheetIntelligenceForReview(
    status ?? undefined,
    Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 50,
  );

  return apiSuccess({ items });
});
