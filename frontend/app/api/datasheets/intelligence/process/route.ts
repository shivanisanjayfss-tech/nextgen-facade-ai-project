import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api-response";
import { normalizePagination } from "@/lib/pagination";
import {
  processDatasheetIntelligence,
  processPendingDatasheetIntelligence,
} from "@/services/datasheet-intelligence.service";

export const runtime = "nodejs";

/**
 * POST /api/datasheets/intelligence/process
 *
 * Process pending datasheet intelligence rows or a specific material.
 * Body: { materialId?: string, limit?: number }
 */
export const POST = withApiHandler(async (request: NextRequest) => {
  const body = (await request.json().catch(() => ({}))) as {
    materialId?: string;
    limit?: number;
  };

  if (body.materialId?.trim()) {
    const result = await processDatasheetIntelligence(body.materialId.trim());
    return apiSuccess({ results: [result] });
  }

  const limit = Number.isFinite(body.limit) ? Math.min(Math.max(body.limit ?? 5, 1), 20) : 5;
  const results = await processPendingDatasheetIntelligence(limit);
  return apiSuccess({ results });
});

/**
 * GET /api/datasheets/intelligence/process
 *
 * Convenience GET for processing pending rows (?limit=5).
 */
export const GET = withApiHandler(async (request: NextRequest) => {
  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "5");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 20) : 5;
  const results = await processPendingDatasheetIntelligence(limit);
  return apiSuccess({ results });
});
