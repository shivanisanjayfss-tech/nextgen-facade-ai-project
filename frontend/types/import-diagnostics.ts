import type { CrawlPollUpdate, IgnoredPage } from "@/types/import";
import type { ImportHistoryStatus } from "@/types/import-history";
import type { ImportRunTrigger } from "@/types/import-scheduler";

/** Terminal status for a batch scheduler run. */
export type SchedulerRunStatus = ImportHistoryStatus;

/** Supabase row shape for `import_scheduler_runs`. */
export interface ImportSchedulerRunRow {
  id: string;
  trigger: ImportRunTrigger | "registry";
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  status: SchedulerRunStatus;
  manufacturer_total: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  ignored: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/** Crawl diagnostics persisted on import_history.diagnostics. */
export interface ImportHistoryDiagnostics {
  poll_updates?: CrawlPollUpdate[];
  ignored_pages?: IgnoredPage[];
  crawl_urls?: string[];
  notes?: string[];
  actor_logs?: string;
  discovered_product_urls?: string[];
  crawl_start_urls?: string[];
  actor_input?: Record<string, unknown>;
}

/** Supabase row shape for `import_run_events`. */
export interface ImportRunEventRow {
  id: string;
  scheduler_run_id: string | null;
  import_history_id: string | null;
  manufacturer: string | null;
  stage: string;
  detail: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Stages persisted to import_run_events (subset of ImportSchedulerStage). */
export const PERSISTED_IMPORT_RUN_STAGES = new Set([
  "scheduler_started",
  "manufacturer_selected",
  "crawl_started",
  "apify_request_sent",
  "apify_response_received",
  "products_extracted",
  "database_upsert_complete",
  "manufacturer_finished",
  "scheduler_completed",
]);
