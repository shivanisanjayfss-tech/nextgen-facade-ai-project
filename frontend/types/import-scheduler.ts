import type { ImportHistoryStatus } from "@/types/import-history";
import type { MaterialPersistDecision } from "@/types/import";

/** Row shape for import_scheduler_settings. */
export interface ImportSchedulerSettingsRow {
  id: string;
  enabled: boolean;
  frequency: string;
  cron_expression: string;
  schedule_hour: number;
  schedule_day_of_month: number;
  timezone: string;
  last_successful_run_at: string | null;
  last_failed_run_at: string | null;
  currently_running_manufacturer: string | null;
  last_run_trigger: "cron" | "manual" | null;
  updated_at: string;
  run_in_progress: boolean;
  progress_manufacturer_index: number;
  progress_manufacturer_total: number;
  progress_imported: number;
  progress_updated: number;
  progress_skipped: number;
  progress_failed: number;
  last_run_started_at: string | null;
  last_run_finished_at: string | null;
  last_run_duration_seconds: number | null;
  last_run_imported: number;
  last_run_updated: number;
  last_run_skipped: number;
  last_run_failed: number;
}

/** Manufacturer entry used by the automatic import scheduler queue. */
export interface ScheduledManufacturer {
  /** Registry primary key — required for id-based import resolution. */
  id: string;
  manufacturer: string;
  brand?: string;
  url: string;
  category: string;
  importStrategy?: string;
  slug?: string;
}

/** Row shape for import_manufacturers (scheduler manufacturer configuration). */
export interface ImportManufacturerRow {
  id: string;
  manufacturer: string;
  brand: string | null;
  website_url: string;
  category: string;
  enabled: boolean;
  auto_import: boolean;
  strategy_key: string;
  logo_url: string | null;
  description: string | null;
  country: string | null;
  slug: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Supported import strategy keys — maps to strategy classes server-side. */
export type ImportStrategyKey =
  | "generic"
  | "alucobond"
  | "agc-glass"
  | "guardian-glass"
  | "mitsubishi-chemical"
  | "saint-gobain";

export interface UpdateImportManufacturerInput {
  enabled?: boolean;
  auto_import?: boolean;
  strategy_key?: ImportStrategyKey;
  website_url?: string;
  category?: string;
  brand?: string | null;
  logo_url?: string | null;
  description?: string | null;
  country?: string | null;
  sort_order?: number;
}

/** Live progress while a scheduled import is running. */
export interface ImportSchedulerProgress {
  manufacturerIndex: number;
  manufacturerTotal: number;
  currentManufacturer: string | null;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
}

/** Public scheduler status returned by GET /api/import/scheduler. */
export interface ImportSchedulerStatus {
  enabled: boolean;
  frequency: string;
  cronExpression: string;
  scheduleDescription: string;
  timezone: string;
  nextScheduledRunAt: string;
  lastSuccessfulRunAt: string | null;
  lastFailedRunAt: string | null;
  currentlyRunningManufacturer: string | null;
  enabledManufacturerCount: number;
  isRunning: boolean;
  runInProgress: boolean;
  progress: ImportSchedulerProgress | null;
  lastRun: {
    startedAt: string | null;
    finishedAt: string | null;
    durationSeconds: number | null;
    imported: number;
    updated: number;
    skipped: number;
    failed: number;
    trigger: "cron" | "manual" | null;
  };
}

export type ImportRunTrigger = "cron" | "manual";

export interface RunScheduledImportsResult {
  skipped: boolean;
  skipReason?: "disabled" | "already_running" | "no_manufacturers";
  trigger: ImportRunTrigger;
  started?: boolean;
  result?: {
    manufacturers: Array<{
      manufacturer: string;
      imported: number;
      updated: number;
      skipped: number;
      failed: number;
      ignored: number;
      extractedProducts: number;
      crawlStatus: string;
      status: ImportHistoryStatus;
      duration: number;
      errorMessage?: string;
      decisions?: MaterialPersistDecision[];
    }>;
    totals: {
      imported: number;
      updated: number;
      skipped: number;
      failed: number;
      ignored: number;
    };
  };
}
