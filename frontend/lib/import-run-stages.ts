import { PERSISTED_IMPORT_RUN_STAGES } from "@/types/import-diagnostics";

/** Ordered list of pipeline stages persisted to import_run_events. */
export const PERSISTED_IMPORT_RUN_STAGE_ORDER = [
  "scheduler_started",
  "manufacturer_selected",
  "crawl_started",
  "apify_request_sent",
  "apify_response_received",
  "products_extracted",
  "database_upsert_complete",
  "manufacturer_finished",
  "scheduler_completed",
] as const;

export type PersistedImportRunStage = (typeof PERSISTED_IMPORT_RUN_STAGE_ORDER)[number];

const STAGE_LABELS: Record<PersistedImportRunStage, string> = {
  scheduler_started: "Scheduler started",
  manufacturer_selected: "Manufacturer selected",
  crawl_started: "Crawl started",
  apify_request_sent: "Apify request sent",
  apify_response_received: "Apify response received",
  products_extracted: "Products extracted",
  database_upsert_complete: "Database upsert complete",
  manufacturer_finished: "Manufacturer finished",
  scheduler_completed: "Scheduler completed",
};

export function formatPersistedStageLabel(stage: string): string {
  if (stage in STAGE_LABELS) {
    return STAGE_LABELS[stage as PersistedImportRunStage];
  }
  return stage.replace(/_/g, " ");
}

export function isPersistedImportRunStage(stage: string): boolean {
  return PERSISTED_IMPORT_RUN_STAGES.has(stage);
}

export function getRecordedStageSet(stages: string[]): Set<string> {
  return new Set(stages.filter(isPersistedImportRunStage));
}
