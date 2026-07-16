import type { MaterialPersistDecision } from "@/types/import";

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
