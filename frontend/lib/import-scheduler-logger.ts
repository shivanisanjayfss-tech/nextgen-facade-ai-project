import { getImportRunLogContext } from "@/lib/import-run-log-context";
import { recordImportRunEvent } from "@/services/import-run-events.service";
import { PERSISTED_IMPORT_RUN_STAGES } from "@/types/import-diagnostics";

/** Pipeline stages for scheduled manufacturer imports. */
export type ImportSchedulerStage =
  | "scheduler_started"
  | "manufacturer_selected"
  | "crawl_started"
  | "apify_request_sent"
  | "apify_polling"
  | "apify_response_received"
  | "products_extracted"
  | "database_upsert_complete"
  | "progress_updated"
  | "manufacturer_finished"
  | "next_manufacturer_started"
  | "scheduler_completed";

export interface ImportSchedulerLogContext {
  manufacturer?: string;
  manufacturerIndex?: number;
  manufacturerTotal?: number;
  stage: ImportSchedulerStage;
  detail?: string;
  imported?: number;
  updated?: number;
  skipped?: number;
  failed?: number;
  crawledPages?: number;
  apifyStatus?: string;
  runId?: string;
  /** Override auto-detected persistence context. */
  schedulerRunId?: string;
  importHistoryId?: string;
}

function resolvePersistedStage(stage: ImportSchedulerStage): string | null {
  if (stage === "next_manufacturer_started") {
    return "manufacturer_selected";
  }

  if (!PERSISTED_IMPORT_RUN_STAGES.has(stage)) {
    return null;
  }

  return stage;
}

function buildEventMetadata(context: ImportSchedulerLogContext): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  if (typeof context.manufacturerIndex === "number") {
    metadata.manufacturerIndex = context.manufacturerIndex;
  }
  if (typeof context.manufacturerTotal === "number") {
    metadata.manufacturerTotal = context.manufacturerTotal;
  }
  if (typeof context.imported === "number") metadata.imported = context.imported;
  if (typeof context.updated === "number") metadata.updated = context.updated;
  if (typeof context.skipped === "number") metadata.skipped = context.skipped;
  if (typeof context.failed === "number") metadata.failed = context.failed;
  if (typeof context.crawledPages === "number") metadata.crawledPages = context.crawledPages;
  if (context.apifyStatus) metadata.apifyStatus = context.apifyStatus;
  if (context.runId) metadata.runId = context.runId;

  return metadata;
}

function persistStageToDatabase(context: ImportSchedulerLogContext): void {
  const persistedStage = resolvePersistedStage(context.stage);
  if (!persistedStage) return;

  const logContext = getImportRunLogContext();

  void recordImportRunEvent({
    schedulerRunId: context.schedulerRunId ?? logContext.schedulerRunId ?? null,
    importHistoryId: context.importHistoryId ?? logContext.importHistoryId ?? null,
    manufacturer: context.manufacturer ?? logContext.manufacturer ?? null,
    stage: persistedStage,
    detail: context.detail ?? null,
    metadata: buildEventMetadata(context),
  });
}

/** Emits a structured log line for every scheduler pipeline stage. */
export function logImportSchedulerStage(context: ImportSchedulerLogContext): void {
  const parts = [
    `[import-scheduler] stage=${context.stage}`,
  ];

  if (context.manufacturer) {
    parts.push(`manufacturer="${context.manufacturer}"`);
  }

  if (
    typeof context.manufacturerIndex === "number" &&
    typeof context.manufacturerTotal === "number"
  ) {
    parts.push(`progress=${context.manufacturerIndex}/${context.manufacturerTotal}`);
  }

  if (context.detail) {
    parts.push(`detail="${context.detail}"`);
  }

  if (typeof context.crawledPages === "number") {
    parts.push(`crawledPages=${context.crawledPages}`);
  }

  if (context.apifyStatus) {
    parts.push(`apifyStatus=${context.apifyStatus}`);
  }

  if (context.runId) {
    parts.push(`runId=${context.runId}`);
  }

  if (
    typeof context.imported === "number" ||
    typeof context.updated === "number" ||
    typeof context.skipped === "number" ||
    typeof context.failed === "number"
  ) {
    parts.push(
      `totals=imported:${context.imported ?? 0},updated:${context.updated ?? 0},skipped:${context.skipped ?? 0},failed:${context.failed ?? 0}`,
    );
  }

  console.info(parts.join(" "));
  persistStageToDatabase(context);
}
