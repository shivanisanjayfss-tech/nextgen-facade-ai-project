import { ServiceError } from "@/lib/errors";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { DB_TABLES } from "@/types/database";
import type { ImportSchedulerRunRow, SchedulerRunStatus } from "@/types/import-diagnostics";
import type { ImportRunTrigger } from "@/types/import-scheduler";

let useMemorySchedulerRuns = false;

function isMissingSchedulerRunsTable(message?: string): boolean {
  return Boolean(
    message?.includes("import_scheduler_runs") &&
      (message.includes("Could not find the table") ||
        message.includes("does not exist")),
  );
}

function requireSupabase() {
  const supabase = getSupabaseServer();
  if (!supabase) {
    throw new ServiceError(
      "Supabase is not configured.",
      "SUPABASE_NOT_CONFIGURED",
      503,
    );
  }
  return supabase;
}

function normalizeSchedulerRunRow(
  row: Partial<ImportSchedulerRunRow>,
): ImportSchedulerRunRow {
  return {
    id: row.id ?? "",
    trigger: (row.trigger as ImportSchedulerRunRow["trigger"]) ?? "manual",
    started_at: row.started_at ?? new Date().toISOString(),
    finished_at: row.finished_at ?? null,
    duration_seconds: row.duration_seconds ?? null,
    status: (row.status as SchedulerRunStatus) ?? "running",
    manufacturer_total: row.manufacturer_total ?? 0,
    imported: row.imported ?? 0,
    updated: row.updated ?? 0,
    skipped: row.skipped ?? 0,
    failed: row.failed ?? 0,
    ignored: row.ignored ?? 0,
    error_message: row.error_message ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

export interface CreateSchedulerRunInput {
  trigger: ImportRunTrigger;
  manufacturerTotal: number;
  startedAt?: string;
}

export interface FinalizeSchedulerRunInput {
  id: string;
  status: SchedulerRunStatus;
  finishedAt: string;
  durationSeconds: number;
  totals: {
    imported: number;
    updated: number;
    skipped: number;
    failed: number;
    ignored: number;
  };
  errorMessage?: string;
}

/** Creates a running batch record when a scheduler import starts. */
export async function createSchedulerRunRecord(
  input: CreateSchedulerRunInput,
): Promise<string | null> {
  if (!isSupabaseConfigured() || useMemorySchedulerRuns) {
    return null;
  }

  const supabase = requireSupabase();
  const startedAt = input.startedAt ?? new Date().toISOString();

  const { data, error } = await supabase
    .from(DB_TABLES.importSchedulerRuns)
    .insert({
      trigger: input.trigger,
      started_at: startedAt,
      status: "running",
      manufacturer_total: input.manufacturerTotal,
    })
    .select("id")
    .single();

  if (error || !data) {
    const message = error?.message ?? "unknown error";
    if (isMissingSchedulerRunsTable(message)) {
      useMemorySchedulerRuns = true;
      console.warn(
        "[import-scheduler-runs] Table missing — batch runs not persisted until migration 022 is applied.",
      );
      return null;
    }

    console.error("[import-scheduler-runs] Failed to create batch run:", message);
    return null;
  }

  return data.id as string;
}

/** Finalizes a batch record with totals and terminal status. */
export async function finalizeSchedulerRunRecord(
  input: FinalizeSchedulerRunInput,
): Promise<void> {
  if (!isSupabaseConfigured() || useMemorySchedulerRuns || !input.id) {
    return;
  }

  const supabase = requireSupabase();
  const { error } = await supabase
    .from(DB_TABLES.importSchedulerRuns)
    .update({
      finished_at: input.finishedAt,
      duration_seconds: input.durationSeconds,
      status: input.status,
      imported: input.totals.imported,
      updated: input.totals.updated,
      skipped: input.totals.skipped,
      failed: input.totals.failed,
      ignored: input.totals.ignored,
      error_message: input.errorMessage ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    if (isMissingSchedulerRunsTable(error.message)) {
      useMemorySchedulerRuns = true;
      return;
    }

    console.error("[import-scheduler-runs] Failed to finalize batch run:", error.message);
  }
}

/** Resolves batch terminal status from per-manufacturer outcomes. */
export function resolveSchedulerRunStatus(
  reports: Array<{ status: SchedulerRunStatus }>,
  batchFailed = false,
): SchedulerRunStatus {
  if (batchFailed) return "failed";
  if (reports.length === 0) return "failed";

  const failedCount = reports.filter((report) => report.status === "failed").length;
  const succeededCount = reports.filter((report) => report.status === "succeeded").length;

  if (failedCount === reports.length) return "failed";
  if (succeededCount === reports.length) return "succeeded";
  return "partial";
}

/** Loads a batch run by id (for future phases). */
export async function getSchedulerRunById(
  id: string,
): Promise<ImportSchedulerRunRow | null> {
  if (!isSupabaseConfigured() || useMemorySchedulerRuns) {
    return null;
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(DB_TABLES.importSchedulerRuns)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (isMissingSchedulerRunsTable(error.message)) {
      useMemorySchedulerRuns = true;
      return null;
    }

    throw new ServiceError(
      `Failed to load scheduler run: ${error.message}`,
      "SCHEDULER_RUN_READ_FAILED",
      500,
    );
  }

  if (!data) return null;
  return normalizeSchedulerRunRow(data as Partial<ImportSchedulerRunRow>);
}
