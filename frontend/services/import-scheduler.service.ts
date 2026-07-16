import { IMPORT_SCHEDULER_FREQUENCY, IMPORT_SCHEDULER_MAX_RETRIES } from "@/lib/import-scheduler-config";
import {
  getActiveSchedulerRun,
  setActiveSchedulerRun,
} from "@/lib/scheduler-global-store";
import { buildManufacturerImportQueue } from "@/services/manufacturer-registry.service";
import {
  beginSchedulerRun,
  clearSchedulerRunState,
  completeSchedulerRun,
  getImportSchedulerSettings,
  isSchedulerRunActive,
  updateSchedulerRunProgress,
} from "@/services/import-scheduler-settings.service";
import { runAllManufacturerImports } from "@/services/scheduled-import.service";
import type {
  ImportRunTrigger,
  RunScheduledImportsResult,
} from "@/types/import-scheduler";
import type { ManufacturerImportFrequency } from "@/types/manufacturer-registry";

export interface RunScheduledImportsOptions {
  trigger: ImportRunTrigger;
  /** When true, runs even if the scheduler is disabled (admin "Run Now"). */
  force?: boolean;
  /** When true, returns immediately and runs in the background (admin UI). */
  background?: boolean;
}

async function executeScheduledImports(
  trigger: ImportRunTrigger,
  manufacturers: Awaited<ReturnType<typeof buildManufacturerImportQueue>>,
): Promise<RunScheduledImportsResult> {
  const startedAt = Date.now();

  await beginSchedulerRun({
    trigger,
    manufacturerTotal: manufacturers.length,
  });

  const runningTotals = {
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    ignored: 0,
  };

  try {
    const result = await runAllManufacturerImports({
      manufacturers,
      useFullImport: true,
      maxRetries: IMPORT_SCHEDULER_MAX_RETRIES,
      onManufacturerStart: async (manufacturer, index, total) => {
        await updateSchedulerRunProgress({
          manufacturer,
          manufacturerIndex: index,
          manufacturerTotal: total,
          imported: runningTotals.imported,
          updated: runningTotals.updated,
          skipped: runningTotals.skipped,
          failed: runningTotals.failed,
        });
      },
      onManufacturerComplete: async (report, index, total) => {
        runningTotals.imported += report.imported;
        runningTotals.updated += report.updated;
        runningTotals.skipped += report.skipped;
        runningTotals.failed += report.failed;
        runningTotals.ignored += report.ignored;

        await updateSchedulerRunProgress({
          manufacturer: report.manufacturer,
          manufacturerIndex: index,
          manufacturerTotal: total,
          imported: runningTotals.imported,
          updated: runningTotals.updated,
          skipped: runningTotals.skipped,
          failed: runningTotals.failed,
        });
      },
      syncProductLifecycle: true,
    });

    const durationSeconds = Number(
      ((Date.now() - startedAt) / 1000).toFixed(2),
    );

    const hadFailures = result.manufacturers.some(
      (report) => report.status === "failed",
    );

    await completeSchedulerRun({
      trigger,
      hadFailures,
      durationSeconds,
      totals: {
        imported: result.totals.imported,
        updated: result.totals.updated,
        skipped: result.totals.skipped,
        failed: result.totals.failed,
      },
    });

    return {
      skipped: false,
      trigger,
      result: {
        manufacturers: result.manufacturers.map((report) => ({
          manufacturer: report.manufacturer,
          imported: report.imported,
          updated: report.updated,
          skipped: report.skipped,
          failed: report.failed,
          ignored: report.ignored,
          extractedProducts: report.extractedProducts,
          crawlStatus: report.crawlStatus,
          status: report.status,
          duration: report.duration,
          errorMessage: report.errorMessage,
          decisions: report.decisions,
        })),
        totals: result.totals,
      },
    };
  } catch (error) {
    await clearSchedulerRunState();
    throw error;
  }
}

/**
 * Entry point for cron and manual scheduled imports.
 * Wraps the existing Apify importer without changing core import logic.
 */
export async function runScheduledImports(
  options: RunScheduledImportsOptions,
): Promise<RunScheduledImportsResult> {
  if (isSchedulerRunActive() || getActiveSchedulerRun()) {
    return {
      skipped: true,
      skipReason: "already_running",
      trigger: options.trigger,
    };
  }

  const settings = await getImportSchedulerSettings();

  if (options.trigger === "cron" && !settings.enabled) {
    return {
      skipped: true,
      skipReason: "disabled",
      trigger: options.trigger,
    };
  }

  const manufacturers = await buildManufacturerImportQueue({
    frequency:
      (settings.frequency as ManufacturerImportFrequency) ?? IMPORT_SCHEDULER_FREQUENCY,
  });

  if (manufacturers.length === 0) {
    console.warn(
      "[import-scheduler] No manufacturers in import queue (enabled=true, auto_import=true).",
    );

    return {
      skipped: true,
      skipReason: "no_manufacturers",
      trigger: options.trigger,
    };
  }

  if (options.background) {
    const runPromise = executeScheduledImports(options.trigger, manufacturers)
      .catch(async (error) => {
        const durationSeconds = 0;
        await completeSchedulerRun({
          trigger: options.trigger,
          hadFailures: true,
          durationSeconds,
          totals: {
            imported: 0,
            updated: 0,
            skipped: 0,
            failed: manufacturers.length,
          },
        });
        console.error("[import-scheduler] Background run failed:", error);
        throw error;
      })
      .finally(() => {
        setActiveSchedulerRun(null);
      });

    setActiveSchedulerRun(runPromise);

    return {
      skipped: false,
      trigger: options.trigger,
      started: true,
    };
  }

  const runPromise = executeScheduledImports(options.trigger, manufacturers).finally(
    () => {
      setActiveSchedulerRun(null);
    },
  );

  setActiveSchedulerRun(runPromise);
  return runPromise;
}
