import type { ScheduledManufacturer } from "@/types/import-scheduler";
import { isServiceError, ServiceError } from "@/lib/errors";
import { isApifyConfigured } from "@/lib/env";
import { IMPORT_SCHEDULER_MAX_RETRIES } from "@/lib/import-scheduler-config";
import { buildImportHistoryDiagnostics } from "@/lib/import-history-diagnostics";
import {
  clearImportRunLogContext,
  setImportRunLogContext,
} from "@/lib/import-run-log-context";
import { logImportSchedulerStage } from "@/lib/import-scheduler-logger";
import {
  buildManufacturerImportQueue,
  getManufacturerRegistryById,
  mapRegistryRowToScheduledManufacturer,
} from "@/services/manufacturer-registry.service";
import { recordManufacturerImportComplete } from "@/services/import-manufacturer-config.service";
import { resolveImportStrategy } from "@/services/import-strategies";
import {
  createImportHistoryRecord,
  finalizeImportHistoryRecord,
} from "@/services/import-history.service";
import { IMPORT_MODE_LIMITS } from "@/services/import-limits";
import { syncManufacturerProductLifecycle } from "@/services/material-lifecycle.service";
import { importManufacturerProducts } from "@/services/manufacturer-import.service";
import { persistCrawledProducts } from "@/services/material-import.service";
import {
  buildImportPersistContextFromRegistry,
} from "@/services/manufacturer-identity.service";
import type {
  ImportHistoryStatus,
  ManufacturerImportReport,
  RunAllImportsResult,
} from "@/types/import-history";
import type { CrawlImportResult } from "@/types/import";
import type { ImportRunTrigger } from "@/types/import-scheduler";

export interface RunAllImportsOptions {
  manufacturers?: ScheduledManufacturer[];
  /** Use full import limits (50 pages, 180s) for scheduled runs. */
  useFullImport?: boolean;
  maxRetries?: number;
  syncProductLifecycle?: boolean;
  schedulerRunId?: string | null;
  trigger?: ImportRunTrigger | "registry";
  onManufacturerStart?: (
    manufacturer: string,
    index: number,
    total: number,
  ) => void | Promise<void>;
  onManufacturerComplete?: (
    report: ManufacturerImportReport,
    index: number,
    total: number,
  ) => void | Promise<void>;
  onManufacturerStage?: (update: {
    manufacturer: string;
    manufacturerIndex: number;
    manufacturerTotal: number;
    stage: string;
    detail?: string;
  }) => void | Promise<void>;
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

async function runManufacturerImportAttempt(
  entry: ScheduledManufacturer,
  limits: { maxPages: number; limit: number; timeout: number },
  syncProductLifecycle: boolean,
  progress?: {
    manufacturerIndex?: number;
    manufacturerTotal?: number;
    onStage?: RunAllImportsOptions["onManufacturerStage"];
  },
): Promise<{
  report: Omit<ManufacturerImportReport, "manufacturer" | "duration">;
  durationSeconds: number;
  errorMessage?: string;
  crawlResult?: CrawlImportResult;
}> {
  const startedAt = new Date();

  const strategy = resolveImportStrategy(entry.manufacturer, entry.importStrategy);
  const importOptions = strategy.buildOptions({
    manufacturer: entry.manufacturer,
    brand: entry.brand,
    websiteUrl: entry.url,
    category: entry.category,
    maxPages: limits.maxPages,
    limit: limits.limit,
    timeoutMs: limits.timeout,
  });

  logImportSchedulerStage({
    stage: "crawl_started",
    manufacturer: entry.manufacturer,
    manufacturerIndex: progress?.manufacturerIndex,
    manufacturerTotal: progress?.manufacturerTotal,
    detail: `strategy=${strategy.id} (importManufacturerProducts — crawlManufacturer not yet implemented)`,
  });

  await progress?.onStage?.({
    manufacturer: entry.manufacturer,
    manufacturerIndex: progress?.manufacturerIndex ?? 0,
    manufacturerTotal: progress?.manufacturerTotal ?? 0,
    stage: "crawl_started",
    detail: `Crawling via ${strategy.id} strategy`,
  });

  const crawlResult = await importManufacturerProducts({
    ...importOptions,
    onCrawlPoll: async (poll) => {
      await progress?.onStage?.({
        manufacturer: entry.manufacturer,
        manufacturerIndex: progress?.manufacturerIndex ?? 0,
        manufacturerTotal: progress?.manufacturerTotal ?? 0,
        stage: "apify_polling",
        detail: `Apify ${poll.status} — ${poll.crawledPages} page(s) crawled`,
      });
    },
  });

  logImportSchedulerStage({
    stage: "apify_response_received",
    manufacturer: entry.manufacturer,
    manufacturerIndex: progress?.manufacturerIndex,
    manufacturerTotal: progress?.manufacturerTotal,
    apifyStatus: crawlResult.status,
    crawledPages: crawlResult.crawled_pages,
    runId: crawlResult.run_id,
  });

  logImportSchedulerStage({
    stage: "products_extracted",
    manufacturer: entry.manufacturer,
    manufacturerIndex: progress?.manufacturerIndex,
    manufacturerTotal: progress?.manufacturerTotal,
    detail: `${crawlResult.product_count} product(s) from ${crawlResult.crawled_pages} page(s)`,
  });

  await progress?.onStage?.({
    manufacturer: entry.manufacturer,
    manufacturerIndex: progress?.manufacturerIndex ?? 0,
    manufacturerTotal: progress?.manufacturerTotal ?? 0,
    stage: "products_extracted",
    detail: `Extracted ${crawlResult.product_count} product(s)`,
  });

  const persist = await persistCrawledProducts(
    crawlResult.products,
    buildImportPersistContextFromRegistry({
      id: entry.id,
      name: entry.manufacturer,
      brand: entry.brand ?? null,
    }),
  );

  logImportSchedulerStage({
    stage: "database_upsert_complete",
    manufacturer: entry.manufacturer,
    manufacturerIndex: progress?.manufacturerIndex,
    manufacturerTotal: progress?.manufacturerTotal,
    imported: persist.imported,
    updated: persist.updated,
    skipped: persist.skipped,
    failed: persist.errors.length,
  });

  await progress?.onStage?.({
    manufacturer: entry.manufacturer,
    manufacturerIndex: progress?.manufacturerIndex ?? 0,
    manufacturerTotal: progress?.manufacturerTotal ?? 0,
    stage: "database_upsert_complete",
    detail: `Persisted — imported ${persist.imported}, updated ${persist.updated}, skipped ${persist.skipped}`,
  });

  console.info(
    `[scheduled-import] ${entry.manufacturer}: extracted=${crawlResult.product_count}, imported=${persist.imported}, updated=${persist.updated}, skipped=${persist.skipped}, failed=${persist.errors.length}`,
  );

  if (persist.skipped > 0) {
    for (const decision of persist.decisions.filter(
      (entry) => entry.outcome === "skipped",
    )) {
      console.info(
        `[scheduled-import] ${entry.manufacturer} skipped ${decision.productName}: ${decision.reason}`,
      );
    }
  }

  if (syncProductLifecycle) {
    await syncManufacturerProductLifecycle(
      entry.id,
      crawlResult.products
        .map((product) => product.sourceUrl)
        .filter((url): url is string => Boolean(url?.trim())),
    );
  }

  const finishedAt = new Date();
  const durationSeconds = Number(
    ((finishedAt.getTime() - startedAt.getTime()) / 1000).toFixed(2),
  );

  const status = resolveImportStatus(
    crawlResult.status,
    crawlResult.finished,
    false,
  );

  return {
    report: {
      imported: persist.imported,
      updated: persist.updated,
      skipped: persist.skipped,
      failed: persist.errors.length,
      ignored: crawlResult.ignored_pages.length,
      extractedProducts: crawlResult.product_count,
      crawlStatus: crawlResult.status,
      decisions: persist.decisions,
      status,
    },
    durationSeconds,
    crawlResult,
  };
}

async function importSingleManufacturer(
  entry: ScheduledManufacturer,
  limits: { maxPages: number; limit: number; timeout: number },
  options: {
    maxRetries: number;
    syncProductLifecycle: boolean;
    manufacturerIndex?: number;
    manufacturerTotal?: number;
    onStage?: RunAllImportsOptions["onManufacturerStage"];
    schedulerRunId?: string | null;
    trigger?: ImportRunTrigger | "registry";
  },
): Promise<ManufacturerImportReport> {
  try {
    const startedAt = new Date();
    const startedAtIso = startedAt.toISOString();
    let historyId: string | undefined;
    let lastErrorMessage: string | undefined;
    const strategy = resolveImportStrategy(entry.manufacturer, entry.importStrategy);

    try {
      const historyRecord = await createImportHistoryRecord({
        manufacturer: entry.manufacturer,
        startedAt: startedAtIso,
        schedulerRunId: options.schedulerRunId ?? undefined,
        manufacturerId: entry.id,
        trigger: options.trigger,
        strategyKey: strategy.id,
      });
      historyId = historyRecord?.id;

      if (historyId) {
        setImportRunLogContext({
          schedulerRunId: options.schedulerRunId ?? undefined,
          importHistoryId: historyId,
          manufacturer: entry.manufacturer,
        });
      }
    } catch (historyError) {
      console.error(
        `[scheduled-import] Failed to create history for ${entry.manufacturer}:`,
        historyError,
      );
    }

    for (let attempt = 1; attempt <= options.maxRetries; attempt += 1) {
      try {
        const attemptResult = await runManufacturerImportAttempt(
          entry,
          limits,
          options.syncProductLifecycle,
          {
            manufacturerIndex: options.manufacturerIndex,
            manufacturerTotal: options.manufacturerTotal,
            onStage: options.onStage,
          },
        );

        if (historyId) {
          await finalizeImportHistoryRecord({
            id: historyId,
            finishedAt: new Date().toISOString(),
            status: attemptResult.report.status,
            imported: attemptResult.report.imported,
            updated: attemptResult.report.updated,
            skipped: attemptResult.report.skipped,
            failed: attemptResult.report.failed,
            ignored: attemptResult.report.ignored,
            durationSeconds: attemptResult.durationSeconds,
            extractedProducts: attemptResult.report.extractedProducts,
            productDecisions: attemptResult.report.decisions ?? [],
            crawlStatus: attemptResult.report.crawlStatus,
            crawledPages: attemptResult.crawlResult?.crawled_pages,
            apifyRunId: attemptResult.crawlResult?.run_id,
            apifyRunUrl: attemptResult.crawlResult?.actor_run_url,
            diagnostics: attemptResult.crawlResult
              ? buildImportHistoryDiagnostics(attemptResult.crawlResult)
              : undefined,
          });
        }

        logImportSchedulerStage({
          stage: "manufacturer_finished",
          manufacturer: entry.manufacturer,
          manufacturerIndex: options.manufacturerIndex,
          manufacturerTotal: options.manufacturerTotal,
          imported: attemptResult.report.imported,
          updated: attemptResult.report.updated,
          skipped: attemptResult.report.skipped,
          failed: attemptResult.report.failed,
          detail: `status=${attemptResult.report.status}`,
          schedulerRunId: options.schedulerRunId ?? undefined,
          importHistoryId: historyId,
        });

        if (entry.id) {
          await recordManufacturerImportComplete(entry.id, {
            status: attemptResult.report.status,
          });
        }

        return {
          manufacturer: entry.manufacturer,
          ...attemptResult.report,
          duration: attemptResult.durationSeconds,
        };
      } catch (error) {
        lastErrorMessage = isServiceError(error)
          ? error.message
          : error instanceof Error
            ? error.message
            : "Import failed";

        console.error(
          `[scheduled-import] ${entry.manufacturer} attempt ${attempt}/${options.maxRetries} failed:`,
          lastErrorMessage,
        );

        if (attempt < options.maxRetries) {
          continue;
        }
      }
    }

    const finishedAt = new Date();
    const durationSeconds = Number(
      ((finishedAt.getTime() - startedAt.getTime()) / 1000).toFixed(2),
    );

    if (historyId) {
      await finalizeImportHistoryRecord({
        id: historyId,
        finishedAt: finishedAt.toISOString(),
        status: "failed",
        imported: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        ignored: 0,
        durationSeconds,
        extractedProducts: 0,
        productDecisions: [],
        errorMessage: lastErrorMessage,
        crawlStatus: "FAILED",
      });
    }

    if (entry.id) {
      await recordManufacturerImportComplete(entry.id, {
        status: "failed",
      });
    }

    return {
      manufacturer: entry.manufacturer,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      ignored: 0,
      extractedProducts: 0,
      crawlStatus: "FAILED",
      status: "failed",
      duration: durationSeconds,
      errorMessage: lastErrorMessage,
      decisions: [],
    };
  } finally {
    clearImportRunLogContext();
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

  const manufacturers =
    options.manufacturers ?? (await buildManufacturerImportQueue());
  const limits =
    options.useFullImport !== false
      ? IMPORT_MODE_LIMITS.full
      : IMPORT_MODE_LIMITS.quick;
  const maxRetries = options.maxRetries ?? IMPORT_SCHEDULER_MAX_RETRIES;
  const syncProductLifecycle = options.syncProductLifecycle ?? false;

  const reports: ManufacturerImportReport[] = [];
  const total = manufacturers.length;

  for (const [index, entry] of manufacturers.entries()) {
    await options.onManufacturerStart?.(entry.manufacturer, index + 1, total);

    let report: ManufacturerImportReport;
    try {
      report = await importSingleManufacturer(entry, limits, {
        maxRetries,
        syncProductLifecycle,
        manufacturerIndex: index + 1,
        manufacturerTotal: total,
        onStage: options.onManufacturerStage,
        schedulerRunId: options.schedulerRunId,
        trigger: options.trigger,
      });
      reports.push(report);
    } catch (error) {
      report = {
        manufacturer: entry.manufacturer,
        imported: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        ignored: 0,
        extractedProducts: 0,
        crawlStatus: "FAILED",
        status: "failed",
        duration: 0,
        errorMessage:
          error instanceof Error ? error.message : "Import failed",
        decisions: [],
      };
      reports.push(report);
    }

    await options.onManufacturerComplete?.(report, index + 1, total);
  }

  const totals = reports.reduce(
    (acc, report) => ({
      imported: acc.imported + report.imported,
      updated: acc.updated + report.updated,
      skipped: acc.skipped + report.skipped,
      failed: acc.failed + report.failed,
      ignored: acc.ignored + report.ignored,
    }),
    { imported: 0, updated: 0, skipped: 0, failed: 0, ignored: 0 },
  );

  return { manufacturers: reports, totals };
}

/**
 * Imports a single manufacturer from the registry by id.
 * Used by the admin manufacturer registry "Run Import" action.
 */
export async function runSingleManufacturerImport(
  manufacturerId: string,
  options: Pick<RunAllImportsOptions, "useFullImport" | "maxRetries" | "syncProductLifecycle"> = {},
): Promise<ManufacturerImportReport> {
  if (!isApifyConfigured()) {
    throw new ServiceError(
      "APIFY_API_TOKEN is not configured. Add it to .env.local and restart the dev server.",
      "APIFY_NOT_CONFIGURED",
      503,
    );
  }

  const row = await getManufacturerRegistryById(manufacturerId);
  if (!row) {
    throw new ServiceError(
      "Manufacturer not found in registry.",
      "MANUFACTURER_NOT_FOUND",
      404,
    );
  }

  const entry = mapRegistryRowToScheduledManufacturer(row);
  const limits =
    options.useFullImport !== false
      ? IMPORT_MODE_LIMITS.full
      : IMPORT_MODE_LIMITS.quick;
  const maxRetries = options.maxRetries ?? IMPORT_SCHEDULER_MAX_RETRIES;

  return importSingleManufacturer(entry, limits, {
    maxRetries,
    syncProductLifecycle: options.syncProductLifecycle ?? false,
    trigger: "registry",
  });
}
