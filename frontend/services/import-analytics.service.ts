import { applyImportHistoryFilters } from "@/lib/import-history-filters";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { getImportHistoryById, listImportHistory } from "@/services/import-history.service";
import {
  listImportRunEventsByHistoryId,
  listImportRunEventsBySchedulerRunId,
} from "@/services/import-run-events.service";
import {
  getSchedulerRunById,
  listSchedulerRuns,
} from "@/services/import-scheduler-runs.service";
import type {
  ImportBatchDetail,
  ImportBatchSummary,
  ImportHistoryAnalytics,
  ImportHistoryFilters,
  SlowestManufacturerEntry,
} from "@/types/import-analytics";
import type { ImportHistoryRow, ImportHistoryStatus } from "@/types/import-history";
import { DB_TABLES } from "@/types/database";

const ANALYTICS_ROW_CAP = 500;
const SLOWEST_MANUFACTURER_LIMIT = 5;

function emptyByStatus(): Record<ImportHistoryStatus, number> {
  return {
    running: 0,
    succeeded: 0,
    failed: 0,
    partial: 0,
  };
}

function computeAnalytics(rows: ImportHistoryRow[]): ImportHistoryAnalytics {
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

  const terminalCount =
    byStatus.succeeded + byStatus.partial + byStatus.failed;
  const successRate =
    terminalCount > 0
      ? Math.round((byStatus.succeeded / terminalCount) * 1000) / 10
      : 0;

  const slowestManufacturers: SlowestManufacturerEntry[] = rows
    .filter(
      (row) =>
        typeof row.duration_seconds === "number" &&
        row.duration_seconds > 0 &&
        row.status !== "running",
    )
    .sort((a, b) => (b.duration_seconds ?? 0) - (a.duration_seconds ?? 0))
    .slice(0, SLOWEST_MANUFACTURER_LIMIT)
    .map((row) => ({
      importHistoryId: row.id,
      manufacturer: row.manufacturer,
      durationSeconds: row.duration_seconds ?? 0,
      status: row.status,
      startedAt: row.started_at,
    }));

  return {
    filteredCount: rows.length,
    successRate,
    totals,
    failedRunCount,
    averageDurationSeconds:
      durationCount > 0
        ? Math.round((durationSum / durationCount) * 100) / 100
        : null,
    slowestManufacturers,
    byStatus,
  };
}

async function loadFilteredHistoryRows(
  filters?: ImportHistoryFilters,
  limit = ANALYTICS_ROW_CAP,
): Promise<ImportHistoryRow[]> {
  const rows = await listImportHistory(limit, filters);
  return applyImportHistoryFilters(rows, filters);
}

/** Returns aggregated analytics over filtered import history rows. */
export async function getImportHistoryAnalytics(
  filters?: ImportHistoryFilters,
): Promise<ImportHistoryAnalytics> {
  const rows = await loadFilteredHistoryRows(filters);
  return computeAnalytics(rows);
}

/** Lists scheduler batch runs with manufacturer run counts. */
export async function listImportBatchSummaries(
  limit = 50,
): Promise<ImportBatchSummary[]> {
  const batches = await listSchedulerRuns(limit);
  if (batches.length === 0) return [];

  if (!isSupabaseConfigured()) {
    return batches.map((batch) => ({ ...batch, manufacturerRunCount: 0 }));
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return batches.map((batch) => ({ ...batch, manufacturerRunCount: 0 }));
  }

  const batchIds = batches.map((batch) => batch.id);
  const { data, error } = await supabase
    .from(DB_TABLES.importHistory)
    .select("scheduler_run_id")
    .in("scheduler_run_id", batchIds);

  if (error) {
    const counts = new Map<string, number>();
    const history = await listImportHistory(ANALYTICS_ROW_CAP);
    for (const row of history) {
      if (!row.scheduler_run_id) continue;
      counts.set(
        row.scheduler_run_id,
        (counts.get(row.scheduler_run_id) ?? 0) + 1,
      );
    }

    return batches.map((batch) => ({
      ...batch,
      manufacturerRunCount: counts.get(batch.id) ?? 0,
    }));
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const batchId = row.scheduler_run_id as string | null;
    if (!batchId) continue;
    counts.set(batchId, (counts.get(batchId) ?? 0) + 1);
  }

  return batches.map((batch) => ({
    ...batch,
    manufacturerRunCount: counts.get(batch.id) ?? 0,
  }));
}

/** Returns a batch run with linked manufacturer imports and timeline events. */
export async function getImportBatchDetail(
  batchId: string,
): Promise<ImportBatchDetail | null> {
  const batch = await getSchedulerRunById(batchId);
  if (!batch) return null;

  const manufacturers = await listImportHistory(200, { batchId });
  const events = await listImportRunEventsBySchedulerRunId(batchId);

  return {
    batch,
    manufacturers,
    events,
  };
}

/** Loads a single import run with optional stage events for auditing. */
export async function getImportHistoryDetail(
  id: string,
  includeEvents = false,
): Promise<{
  run: ImportHistoryRow;
  events: Awaited<ReturnType<typeof listImportRunEventsByHistoryId>>;
} | null> {
  const run = await getImportHistoryById(id);
  if (!run) return null;

  const events = includeEvents ? await listImportRunEventsByHistoryId(id) : [];
  return { run, events };
}
