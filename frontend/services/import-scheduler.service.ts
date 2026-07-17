import { after } from "next/server";
import { IMPORT_SCHEDULER_FREQUENCY, IMPORT_SCHEDULER_MAX_RETRIES } from "@/lib/import-scheduler-config";
import { clearImportRunLogContext } from "@/lib/import-run-log-context";
import { logImportSchedulerStage } from "@/lib/import-scheduler-logger";
import {
  getActiveSchedulerRun,
  setActiveSchedulerRun,
} from "@/lib/scheduler-global-store";
import { buildManufacturerImportQueue } from "@/services/manufacturer-registry.service";
import {
  createSchedulerRunRecord,
  finalizeSchedulerRunRecord,
  resolveSchedulerRunStatus,
} from "@/services/import-scheduler-runs.service";
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
  const startedAtIso = new Date(startedAt).toISOString();
  let schedulerRunId: string | null = null;

  try {
    schedulerRunId = await createSchedulerRunRecord({
      trigger,
      manufacturerTotal: manufacturers.length,
      startedAt: startedAtIso,
    });

    logImportSchedulerStage({
      stage: "scheduler_started",
      manufacturerTotal: manufacturers.length,
      detail: `trigger=${trigger}, queue=${manufacturers.length}`,
      schedulerRunId: schedulerRunId ?? undefined,
    });

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

    const result = await runAllManufacturerImports({
      manufacturers,
      useFullImport: true,
      maxRetries: IMPORT_SCHEDULER_MAX_RETRIES,
      syncProductLifecycle: true,
      schedulerRunId,
      trigger,
      onManufacturerStart: async (manufacturer, index, total) => {
        logImportSchedulerStage({
          stage: index === 1 ? "manufacturer_selected" : "next_manufacturer_started",
          manufacturer,
          manufacturerIndex: index,
          manufacturerTotal: total,
          schedulerRunId: schedulerRunId ?? undefined,
        });

        await updateSchedulerRunProgress({
          manufacturer,
          manufacturerIndex: index,
          manufacturerTotal: total,
          imported: runningTotals.imported,
          updated: runningTotals.updated,
          skipped: runningTotals.skipped,
          failed: runningTotals.failed,
          stage: "manufacturer_selected",
          detail: "Starting manufacturer import",
        });

        logImportSchedulerStage({
          stage: "progress_updated",
          manufacturer,
          manufacturerIndex: index,
          manufacturerTotal: total,
          imported: runningTotals.imported,
          updated: runningTotals.updated,
          skipped: runningTotals.skipped,
          failed: runningTotals.failed,
        });
      },
      onManufacturerStage: async (update) => {
        await updateSchedulerRunProgress({
          manufacturer: update.manufacturer,
          manufacturerIndex: update.manufacturerIndex,
          manufacturerTotal: update.manufacturerTotal,
          imported: runningTotals.imported,
          updated: runningTotals.updated,
          skipped: runningTotals.skipped,
          failed: runningTotals.failed,
          stage: update.stage,
          detail: update.detail,
        });
      },
      onManufacturerComplete: async (report, index, total) => {
        runningTotals.imported += report.imported;
        runningTotals.updated += report.updated;
        runningTotals.skipped += report.skipped;
        runningTotals.failed += report.failed;
        runningTotals.ignored += report.ignored;

        logImportSchedulerStage({
          stage: "manufacturer_finished",
          manufacturer: report.manufacturer,
          manufacturerIndex: index,
          manufacturerTotal: total,
          imported: runningTotals.imported,
          updated: runningTotals.updated,
          skipped: runningTotals.skipped,
          failed: runningTotals.failed,
          detail: `status=${report.status}, extracted=${report.extractedProducts}`,
          schedulerRunId: schedulerRunId ?? undefined,
        });

        await updateSchedulerRunProgress({
          manufacturer: report.manufacturer,
          manufacturerIndex: index,
          manufacturerTotal: total,
          imported: runningTotals.imported,
          updated: runningTotals.updated,
          skipped: runningTotals.skipped,
          failed: runningTotals.failed,
          stage: "manufacturer_finished",
          detail: `Finished — imported ${report.imported}, updated ${report.updated}, skipped ${report.skipped}, failed ${report.failed}`,
        });

        logImportSchedulerStage({
          stage: "progress_updated",
          manufacturer: report.manufacturer,
          manufacturerIndex: index,
          manufacturerTotal: total,
          imported: runningTotals.imported,
          updated: runningTotals.updated,
          skipped: runningTotals.skipped,
          failed: runningTotals.failed,
        });
      },
    });

    const durationSeconds = Number(
      ((Date.now() - startedAt) / 1000).toFixed(2),
    );

    const hadFailures = result.manufacturers.some(
      (report) => report.status === "failed",
    );
    const batchStatus = resolveSchedulerRunStatus(result.manufacturers);

    if (schedulerRunId) {
      await finalizeSchedulerRunRecord({
        id: schedulerRunId,
        status: batchStatus,
        finishedAt: new Date().toISOString(),
        durationSeconds,
        totals: result.totals,
      });
    }

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

    logImportSchedulerStage({
      stage: "scheduler_completed",
      manufacturerTotal: manufacturers.length,
      imported: result.totals.imported,
      updated: result.totals.updated,
      skipped: result.totals.skipped,
      failed: result.totals.failed,
      detail: `duration=${durationSeconds}s`,
      schedulerRunId: schedulerRunId ?? undefined,
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
    const durationSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(2));

    if (schedulerRunId) {
      await finalizeSchedulerRunRecord({
        id: schedulerRunId,
        status: "failed",
        finishedAt: new Date().toISOString(),
        durationSeconds,
        totals: {
          imported: 0,
          updated: 0,
          skipped: 0,
          failed: manufacturers.length,
          ignored: 0,
        },
        errorMessage:
          error instanceof Error ? error.message : "Scheduled import failed",
      });
    }

    await completeSchedulerRun({
      trigger,
      hadFailures: true,
      durationSeconds,
      totals: {
        imported: 0,
        updated: 0,
        skipped: 0,
        failed: manufacturers.length,
      },
    }).catch(() => undefined);

    await clearSchedulerRunState();
    throw error;
  } finally {
    clearImportRunLogContext();
  }
}

function runScheduledImportsInBackground(
  trigger: ImportRunTrigger,
  manufacturers: Awaited<ReturnType<typeof buildManufacturerImportQueue>>,
): Promise<RunScheduledImportsResult> {
  const runPromise = executeScheduledImports(trigger, manufacturers)
    .catch(async (error) => {
      console.error("[import-scheduler] Background run failed:", error);
      throw error;
    })
    .finally(() => {
      setActiveSchedulerRun(null);
    });

  setActiveSchedulerRun(runPromise);
  return runPromise;
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
    after(async () => {
      await runScheduledImportsInBackground(options.trigger, manufacturers);
    });

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
