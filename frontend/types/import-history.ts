import type { MaterialPersistDecision } from "@/types/import";
import type { ImportHistoryDiagnostics } from "@/types/import-diagnostics";

/** Terminal status stored in import_history. */
export type ImportHistoryStatus = "running" | "succeeded" | "failed" | "partial";

/** Supabase row shape for the `import_history` table. */
export interface ImportHistoryRow {
  id: string;
  manufacturer: string;
  started_at: string;
  finished_at: string | null;
  status: ImportHistoryStatus;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  ignored: number;
  duration_seconds: number | null;
  error_message: string | null;
  product_decisions: MaterialPersistDecision[];
  extracted_products: number;
  /** Phase 3a — optional until migration 022 is applied. */
  scheduler_run_id?: string | null;
  manufacturer_id?: string | null;
  trigger?: string | null;
  strategy_key?: string | null;
  crawl_status?: string | null;
  crawled_pages?: number;
  apify_run_id?: string | null;
  apify_run_url?: string | null;
  diagnostics?: ImportHistoryDiagnostics;
}

/** Per-manufacturer result returned by POST /api/import/run-all. */
export interface ManufacturerImportReport {
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
}

/** Aggregated response from POST /api/import/run-all. */
export interface RunAllImportsResult {
  manufacturers: ManufacturerImportReport[];
  totals: {
    imported: number;
    updated: number;
    skipped: number;
    failed: number;
    ignored: number;
  };
}
