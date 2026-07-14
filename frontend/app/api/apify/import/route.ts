import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isServiceError } from "@/lib/errors";
import { isApifyConfigured } from "@/lib/env";
import {
  importManufacturerProducts,
  WEBSITE_CONTENT_CRAWLER_ACTOR,
} from "@/services/manufacturer-import.service";
import {
  buildGuardianGlassImportOptions,
  isGuardianGlassManufacturer,
} from "@/services/guardian-glass-import.service";
import { persistCrawledProducts } from "@/services/material-import.service";
import type { CrawlImportResult, ImportSummary } from "@/types/import";

function buildImportSummary(
  result: CrawlImportResult,
  persist: NonNullable<CrawlImportResult["persist"]>,
): ImportSummary {
  return {
    imported: persist.imported,
    skipped: persist.skipped,
    ignored: result.ignored_pages.length,
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
 * GET /api/apify/import
 *
 * Generic manufacturer import. Crawls the given website with the Website Content
 * Crawler, extracts products, and upserts them into Supabase materials.
 *
 * Query params:
 *   ?manufacturer=Alucobond&url=https://www.alucobond.com/en/products/&category=ACP
 *   &maxPages=50&limit=50&timeout=60000
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const manufacturer = searchParams.get("manufacturer")?.trim() ?? "";
  const websiteUrl = searchParams.get("url")?.trim() ?? "";
  const category = searchParams.get("category")?.trim() ?? "";

  if (!isApifyConfigured()) {
    return apiSuccess({
      source: websiteUrl || "unknown",
      manufacturer: manufacturer || undefined,
      website_url: websiteUrl || undefined,
      category: category || undefined,
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
      ignored_pages: [],
      import_summary: { imported: 0, skipped: 0, ignored: 0 },
      notes: [
        "APIFY_API_TOKEN is not configured. Add it to .env.local and restart the dev server to run the crawl.",
      ],
      persist: { imported: 0, updated: 0, skipped: 0, errors: [] },
    });
  }

  if (!manufacturer) {
    return apiError("Query param 'manufacturer' is required.", 400, "INVALID_REQUEST");
  }

  if (!websiteUrl) {
    return apiError("Query param 'url' is required.", 400, "INVALID_REQUEST");
  }

  if (!category) {
    return apiError("Query param 'category' is required.", 400, "INVALID_REQUEST");
  }

  try {
    new URL(websiteUrl);
  } catch {
    return apiError("Query param 'url' must be a valid URL.", 400, "INVALID_REQUEST");
  }

  const maxPages = clampNumber(searchParams.get("maxPages"), 50, 1, 200);
  const limit = clampNumber(searchParams.get("limit"), 50, 1, 500);
  const timeoutMs = clampNumber(searchParams.get("timeout"), 60_000, 10_000, 300_000);

  try {
    const importOptions = isGuardianGlassManufacturer(manufacturer)
      ? buildGuardianGlassImportOptions({
          websiteUrl,
          category,
          maxPages,
          limit,
          timeoutMs,
        })
      : {
          manufacturer,
          websiteUrl,
          category,
          maxPages,
          limit,
          timeoutMs,
        };

    const result = await importManufacturerProducts(importOptions);

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
      error instanceof Error ? error.message : "Manufacturer import failed";
    return apiError(message, 500, "APIFY_IMPORT_ERROR");
  }
}
