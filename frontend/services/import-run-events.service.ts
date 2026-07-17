import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { DB_TABLES } from "@/types/database";
import type { ImportRunEventRow } from "@/types/import-diagnostics";
import type { ImportSchedulerStage } from "@/lib/import-scheduler-logger";

let useMemoryRunEvents = false;

function isMissingRunEventsTable(message?: string): boolean {
  return Boolean(
    message?.includes("import_run_events") &&
      (message.includes("Could not find the table") ||
        message.includes("does not exist")),
  );
}

export interface RecordImportRunEventInput {
  schedulerRunId?: string | null;
  importHistoryId?: string | null;
  manufacturer?: string | null;
  stage: ImportSchedulerStage | string;
  detail?: string | null;
  metadata?: Record<string, unknown>;
}

/** Persists a structured pipeline event (non-blocking on failure). */
export async function recordImportRunEvent(
  input: RecordImportRunEventInput,
): Promise<void> {
  if (!isSupabaseConfigured() || useMemoryRunEvents) {
    return;
  }

  const supabase = getSupabaseServer();
  if (!supabase) return;

  const { error } = await supabase.from(DB_TABLES.importRunEvents).insert({
    scheduler_run_id: input.schedulerRunId ?? null,
    import_history_id: input.importHistoryId ?? null,
    manufacturer: input.manufacturer ?? null,
    stage: input.stage,
    detail: input.detail ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    if (isMissingRunEventsTable(error.message)) {
      useMemoryRunEvents = true;
      console.warn(
        "[import-run-events] Table missing — events not persisted until migration 022 is applied.",
      );
      return;
    }

    console.error("[import-run-events] Failed to record event:", error.message);
  }
}

/** Returns events for a manufacturer import run (for future phases). */
export async function listImportRunEventsByHistoryId(
  importHistoryId: string,
): Promise<ImportRunEventRow[]> {
  if (!isSupabaseConfigured() || useMemoryRunEvents) {
    return [];
  }

  const supabase = getSupabaseServer();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(DB_TABLES.importRunEvents)
    .select("*")
    .eq("import_history_id", importHistoryId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingRunEventsTable(error.message)) {
      useMemoryRunEvents = true;
      return [];
    }

    console.error("[import-run-events] Failed to list events:", error.message);
    return [];
  }

  return (data ?? []) as ImportRunEventRow[];
}
