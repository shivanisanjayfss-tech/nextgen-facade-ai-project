import {
  SCHEDULED_MANUFACTURERS,
  type ScheduledManufacturer,
} from "@/config/import-manufacturers";
import { isServiceError } from "@/lib/errors";
import { isApifyConfigured } from "@/lib/env";
import { resolveImportStrategy } from "@/services/import-strategies";
import {
  createImportHistoryRecord,
  finalizeImportHistoryRecord,
} from "@/services/import-history.service";
import { IMPORT_MODE_LIMITS } from "@/services/import-limits";
import { importManufacturerProducts } from "@/services/manufacturer-import.service";
import { persistCrawledProducts } from "@/services/material-import.service";
import type {
  ImportHistoryStatus,
  ManufacturerImportReport,
  RunAllImportsResult,
} from "@/types/import-history";

export interface RunAllImportsOptions {
  manufacturers?: ScheduledManufacturer[];
  /** Use full import limits (50 pages, 180s) for scheduled runs. */
  useFullImport?: boolean;
}

function resolveImportStatus(
  crawlStatus: string,
  finished: boolean,
  hasError: boolean,
): ImportHistoryStatus {
  if (hasError) return "failed";
  if (crawlStatus === "FAILED" || crawlStatus === "ABORTED") return "failed";
  if (!finished || crawlStatus === "TIMED-OUT" || crawlStatus === "RUNNING") {
    return "partial";
  }
  return "succeeded";
}

async function importSingleManufacturer(
  entry: ScheduledManufacturer,
  limits: { maxPages: number; limit: number; timeout: number },
): Promise<ManufacturerImportReport> {
  const startedAt = new Date();
  const startedAtIso = startedAt.toISOString();
  let historyId: string | undefined;

  try {
    const historyRecord = await createImportHistoryRecord({
      manufacturer: entry.manufacturer,
      startedAt: startedAtIso,
    });
    historyId = historyRecord.id;

    const strategy = resolveImportStrategy(entry.manufacturer);
    const importOptions = strategy.buildOptions({
      manufacturer: entry.manufacturer,
      websiteUrl: entry.url,
      category: entry.category,
      maxPages: limits.maxPages,
      limit: limits.limit,
      timeoutMs: limits.timeout,
    });

    const crawlResult = await importManufacturerProducts(importOptions);
    const persist = await persistCrawledProducts(crawlResult.products);

    const finishedAt = new Date();
    const durationSeconds = Number(
      ((finishedAt.getTime() - startedAt.getTime()) / 1000).toFixed(2),
    );

    const status = resolveImportStatus(
      crawlResult.status,
      crawlResult.finished,
      false,
    );

    await finalizeImportHistoryRecord({
      id: historyId,
      finishedAt: finishedAt.toISOString(),
      status,
      imported: persist.imported,
      updated: persist.updated,
      skipped: persist.skipped,
      ignored: crawlResult.ignored_pages.length,
      durationSeconds,
    });

    return {
      manufacturer: entry.manufacturer,
      imported: persist.imported,
      updated: persist.updated,
      skipped: persist.skipped,
      ignored: crawlResult.ignored_pages.length,
      status,
      duration: durationSeconds,
    };
  } catch (error) {
    const finishedAt = new Date();
    const durationSeconds = Number(
      ((finishedAt.getTime() - startedAt.getTime()) / 1000).toFixed(2),
    );
    const errorMessage = isServiceError(error)
      ? error.message
      : error instanceof Error
        ? error.message
        : "Import failed";

    if (historyId) {
      await finalizeImportHistoryRecord({
        id: historyId,
        finishedAt: finishedAt.toISOString(),
        status: "failed",
        imported: 0,
        updated: 0,
        skipped: 0,
        ignored: 0,
        durationSeconds,
        errorMessage,
      });
    }

    return {
      manufacturer: entry.manufacturer,
      imported: 0,
      updated: 0,
      skipped: 0,
      ignored: 0,
      status: "failed",
      duration: durationSeconds,
    };
  }
}

/**
 * Imports every configured manufacturer sequentially.
 * Continues when one manufacturer fails and records each run in import_history.
 */
export async function runAllManufacturerImports(
  options: RunAllImportsOptions = {},
): Promise<RunAllImportsResult> {
  if (!isApifyConfigured()) {
    throw new Error(
      "APIFY_API_TOKEN is not configured. Add it to .env.local and restart the dev server.",
    );
  }

  const manufacturers = options.manufacturers ?? SCHEDULED_MANUFACTURERS;
  const limits = options.useFullImport !== false
    ? IMPORT_MODE_LIMITS.full
    : IMPORT_MODE_LIMITS.quick;

  const reports: ManufacturerImportReport[] = [];

  for (const entry of manufacturers) {
    const report = await importSingleManufacturer(entry, limits);
    reports.push(report);
  }

  const totals = reports.reduce(
    (acc, report) => ({
      imported: acc.imported + report.imported,
      updated: acc.updated + report.updated,
      skipped: acc.skipped + report.skipped,
      ignored: acc.ignored + report.ignored,
    }),
    { imported: 0, updated: 0, skipped: 0, ignored: 0 },
  );

  return { manufacturers: reports, totals };
}
