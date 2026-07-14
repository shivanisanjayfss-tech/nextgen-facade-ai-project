import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isServiceError } from "@/lib/errors";
import { isApifyConfigured } from "@/lib/env";
import {
  importAlucobondProducts,
  WEBSITE_CONTENT_CRAWLER_ACTOR,
} from "@/services/alucobond-import.service";
import { persistCrawledProducts } from "@/services/material-import.service";
import type { CrawlImportResult, ImportSummary } from "@/types/import";

function buildImportSummary(
  result: CrawlImportResult,
  persist: NonNullable<CrawlImportResult["persist"]>,
): ImportSummary {
  return {
    imported: persist.imported,
    updated: persist.updated,
    skipped: persist.skipped,
    ignored: result.ignored_pages.length,
    duplicates_merged: persist.duplicates_merged,
  };
}

function clampNumber(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

/**
 * GET /api/apify/alucobond
 *
 * Crawls alucobond.com product pages via the Website Content Crawler Actor,
 * upserts results into Supabase materials (deduped by slug / source_url), and
 * returns structured JSON with import counts.
 *
 * Query params: ?maxPages=25&limit=50&timeout=60000
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  if (!isApifyConfigured()) {
    return apiSuccess({
      source: "alucobond.com",
      actor_id: WEBSITE_CONTENT_CRAWLER_ACTOR,
      status: "NOT_CONFIGURED",
      finished: false,
      crawled_pages: 0,
      product_count: 0,
      products: [],
      discovered_product_urls: [],
      discovered_entry_urls: [],
      crawl_start_urls: [],
      crawl_urls: [],
      poll_updates: [],
      ignored_pages: [],
      import_summary: {
        imported: 0,
        updated: 0,
        skipped: 0,
        ignored: 0,
        duplicates_merged: 0,
      },
      notes: [
        "APIFY_API_TOKEN is not configured. Add it to .env.local and restart the dev server to run the crawl.",
      ],
      persist: {
        imported: 0,
        updated: 0,
        skipped: 0,
        duplicates_merged: 0,
        errors: [],
      },
    });
  }

  const maxPages = clampNumber(searchParams.get("maxPages"), 25, 1, 200);
  const limit = clampNumber(searchParams.get("limit"), 50, 1, 500);
  const timeoutMs = clampNumber(searchParams.get("timeout"), 60_000, 10_000, 300_000);

  try {
    const result = await importAlucobondProducts({ maxPages, limit, timeoutMs });

    let persist;
    try {
      persist = await persistCrawledProducts(result.products);
    } catch (error) {
      if (isServiceError(error)) {
        return apiError(error.message, error.status, error.code);
      }

      const message =
        error instanceof Error ? error.message : "Material import failed";
      return apiError(message, 500, "MATERIAL_IMPORT_ERROR");
    }

    const notes = [...result.notes];
    if (persist.errors.length > 0) {
      notes.push(
        `${persist.errors.length} product(s) failed to import — see persist.errors for details.`,
      );
    }

    return apiSuccess({
      ...result,
      notes,
      persist,
      import_summary: buildImportSummary(result, persist),
    });
  } catch (error) {
    if (isServiceError(error)) {
      return apiError(error.message, error.status, error.code);
    }

    const message =
      error instanceof Error ? error.message : "Alucobond import failed";
    return apiError(message, 500, "APIFY_IMPORT_ERROR");
  }
}
