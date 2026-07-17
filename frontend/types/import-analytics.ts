import type { ImportSchedulerRunRow, ImportRunEventRow } from "@/types/import-diagnostics";
import type { ImportHistoryRow, ImportHistoryStatus } from "@/types/import-history";

/** Preset filters for common import history queries. */
export type ImportHistoryPresetFilter = "zero_products" | "updated_only";

/** Query filters for import history list and analytics. */
export interface ImportHistoryFilters {
  status?: ImportHistoryStatus;
  manufacturer?: string;
  trigger?: string;
  /** Maps to import_history.scheduler_run_id */
  batchId?: string;
  from?: string;
  to?: string;
  preset?: ImportHistoryPresetFilter;
}

/** Aggregated metrics over a filtered import history set. */
export interface ImportHistoryAnalytics {
  filteredCount: number;
  /** Percentage 0–100; excludes running rows from denominator. */
  successRate: number;
  totals: {
    imported: number;
    updated: number;
    skipped: number;
    failed: number;
    ignored: number;
  };
  failedRunCount: number;
  averageDurationSeconds: number | null;
  slowestManufacturers: SlowestManufacturerEntry[];
  byStatus: Record<ImportHistoryStatus, number>;
}

export interface SlowestManufacturerEntry {
  importHistoryId: string;
  manufacturer: string;
  durationSeconds: number;
  status: ImportHistoryStatus;
  startedAt: string;
}

/** Batch list item with manufacturer run count. */
export interface ImportBatchSummary extends ImportSchedulerRunRow {
  manufacturerRunCount: number;
}

/** Batch detail with linked manufacturer runs. */
export interface ImportBatchDetail {
  batch: ImportSchedulerRunRow;
  manufacturers: ImportHistoryRow[];
  events: ImportRunEventRow[];
}
