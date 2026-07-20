import type { ImportHistoryUiFilter } from "@/lib/import-history-dashboard";
import type { ImportBatchSummary, ImportHistoryAnalytics } from "@/types/import-analytics";
import type { ImportHistoryRow, ImportHistoryStatus } from "@/types/import-history";

/** Local copy — avoids a runtime import cycle with import-history-dashboard (client chunk). */
function applyClientHistoryFilter(
  rows: ImportHistoryRow[],
  filter: ImportHistoryUiFilter,
): ImportHistoryRow[] {
  return rows.filter((row) => {
    if (filter.status !== "all" && row.status !== filter.status) return false;
    if (filter.preset === "zero_products" && (row.extracted_products ?? 0) !== 0) {
      return false;
    }
    if (filter.preset === "updated_only" && !(row.imported === 0 && row.updated > 0)) {
      return false;
    }
    return true;
  });
}

const SLOWEST_ENTRY_LIMIT = 5;

function emptyByStatus(): Record<ImportHistoryStatus, number> {
  return {
    running: 0,
    succeeded: 0,
    failed: 0,
    partial: 0,
  };
}

/** Whether success rate is meaningful for the active filter selection. */
export function isSuccessRateApplicable(filter?: ImportHistoryUiFilter): boolean {
  if (!filter) return true;
  if (filter.preset) return true;
  if (filter.status === "all" || filter.status === "succeeded") return true;
  return false;
}

/** Computes success rate from status counts; returns null when not meaningful. */
export function computeSuccessRate(
  byStatus: Record<ImportHistoryStatus, number>,
  filter?: ImportHistoryUiFilter,
): number | null {
  if (!isSuccessRateApplicable(filter)) return null;

  const terminalCount =
    byStatus.succeeded + byStatus.partial + byStatus.failed;

  if (terminalCount === 0) return null;

  return Math.round((byStatus.succeeded / terminalCount) * 1000) / 10;
}

function aggregateHistoryMetrics(rows: ImportHistoryRow[]) {
  const byStatus = emptyByStatus();
  const totals = {
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    ignored: 0,
  };

  let failedRunCount = 0;
  let durationSum = 0;
  let durationCount = 0;

  for (const row of rows) {
    byStatus[row.status] += 1;
    totals.imported += row.imported;
    totals.updated += row.updated;
    totals.skipped += row.skipped;
    totals.failed += row.failed;
    totals.ignored += row.ignored;

    if (row.status === "failed") failedRunCount += 1;

    if (typeof row.duration_seconds === "number" && row.duration_seconds >= 0) {
      durationSum += row.duration_seconds;
      durationCount += 1;
    }
  }

  return {
    byStatus,
    totals,
    failedRunCount,
    averageDurationSeconds:
      durationCount > 0
        ? Math.round((durationSum / durationCount) * 100) / 100
        : null,
    slowestManufacturers: rows
      .filter(
        (row) =>
          typeof row.duration_seconds === "number" &&
          row.duration_seconds > 0 &&
          row.status !== "running",
      )
      .sort((a, b) => (b.duration_seconds ?? 0) - (a.duration_seconds ?? 0))
      .slice(0, SLOWEST_ENTRY_LIMIT)
      .map((row) => ({
        importHistoryId: row.id,
        manufacturer: row.manufacturer,
        durationSeconds: row.duration_seconds ?? 0,
        status: row.status,
        startedAt: row.started_at,
      })),
  };
}

/** Aggregates analytics from manufacturer import history rows. */
export function computeHistoryAnalytics(
  rows: ImportHistoryRow[],
  filter?: ImportHistoryUiFilter,
): ImportHistoryAnalytics {
  const metrics = aggregateHistoryMetrics(rows);

  return {
    filteredCount: rows.length,
    successRate: computeSuccessRate(metrics.byStatus, filter),
    totals: metrics.totals,
    failedRunCount: metrics.failedRunCount,
    averageDurationSeconds: metrics.averageDurationSeconds,
    slowestManufacturers: metrics.slowestManufacturers,
    byStatus: metrics.byStatus,
  };
}

/** Applies dashboard filters to scheduler batch summaries. */
export function applyBatchFilter(
  batches: ImportBatchSummary[],
  filter: ImportHistoryUiFilter,
): ImportBatchSummary[] {
  return batches.filter((batch) => {
    if (filter.status !== "all" && batch.status !== filter.status) return false;

    const productTotal =
      batch.imported + batch.updated + batch.skipped + batch.failed;

    if (filter.preset === "zero_products" && productTotal !== 0) return false;
    if (filter.preset === "updated_only" && !(batch.imported === 0 && batch.updated > 0)) {
      return false;
    }

    return true;
  });
}

function aggregateBatchMetrics(batches: ImportBatchSummary[]) {
  const byStatus = emptyByStatus();
  const totals = {
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    ignored: 0,
  };

  let failedRunCount = 0;
  let durationSum = 0;
  let durationCount = 0;

  for (const batch of batches) {
    byStatus[batch.status] += 1;
    totals.imported += batch.imported;
    totals.updated += batch.updated;
    totals.skipped += batch.skipped;
    totals.failed += batch.failed;
    totals.ignored += batch.ignored;

    if (batch.status === "failed") failedRunCount += 1;

    if (typeof batch.duration_seconds === "number" && batch.duration_seconds >= 0) {
      durationSum += batch.duration_seconds;
      durationCount += 1;
    }
  }

  return {
    byStatus,
    totals,
    failedRunCount,
    averageDurationSeconds:
      durationCount > 0
        ? Math.round((durationSum / durationCount) * 100) / 100
        : null,
    slowestManufacturers: batches
      .filter(
        (batch) =>
          typeof batch.duration_seconds === "number" &&
          batch.duration_seconds > 0 &&
          batch.status !== "running",
      )
      .sort((a, b) => (b.duration_seconds ?? 0) - (a.duration_seconds ?? 0))
      .slice(0, SLOWEST_ENTRY_LIMIT)
      .map((batch) => ({
        importHistoryId: batch.id,
        manufacturer: `Batch ${batch.id.slice(0, 8)}`,
        durationSeconds: batch.duration_seconds ?? 0,
        status: batch.status,
        startedAt: batch.started_at,
      })),
  };
}

/** Aggregates analytics from scheduler batch run summaries. */
export function computeBatchAnalytics(
  batches: ImportBatchSummary[],
  filter?: ImportHistoryUiFilter,
): ImportHistoryAnalytics {
  const metrics = aggregateBatchMetrics(batches);

  return {
    filteredCount: batches.length,
    successRate: computeSuccessRate(metrics.byStatus, filter),
    totals: metrics.totals,
    failedRunCount: metrics.failedRunCount,
    averageDurationSeconds: metrics.averageDurationSeconds,
    slowestManufacturers: metrics.slowestManufacturers,
    byStatus: metrics.byStatus,
  };
}

/** Resolves analytics for the active dashboard view from already-filtered table rows. */
export function computeDashboardAnalytics(
  viewMode: "all" | "latest" | "batches",
  options: {
    history: ImportHistoryRow[];
    batches: ImportBatchSummary[];
    filter: ImportHistoryUiFilter;
  },
): ImportHistoryAnalytics {
  if (viewMode === "batches") {
    const filteredBatches = applyBatchFilter(options.batches, options.filter);
    return computeBatchAnalytics(filteredBatches, options.filter);
  }

  const rows =
    viewMode === "latest"
      ? applyClientHistoryFilter(options.history, options.filter)
      : options.history;

  return computeHistoryAnalytics(rows, options.filter);
}
