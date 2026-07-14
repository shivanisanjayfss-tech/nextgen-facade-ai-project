import { ServiceError } from "@/lib/errors";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import type { ImportHistoryRow } from "@/types/import-history";
import { DB_TABLES } from "@/types/database";
import type { ImportHistoryStatus } from "@/types/import-history";

export interface CreateImportHistoryInput {
  manufacturer: string;
  startedAt: string;
}

export interface FinalizeImportHistoryInput {
  id: string;
  finishedAt: string;
  status: ImportHistoryStatus;
  imported: number;
  updated: number;
  skipped: number;
  ignored: number;
  durationSeconds: number;
  errorMessage?: string;
}

function requireSupabase() {
  const supabase = getSupabaseServer();
  if (!supabase) {
    throw new ServiceError(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      "SUPABASE_NOT_CONFIGURED",
      503,
    );
  }
  return supabase;
}

/** Inserts a running import_history row at the start of a manufacturer import. */
export async function createImportHistoryRecord(
  input: CreateImportHistoryInput,
): Promise<ImportHistoryRow> {
  if (!isSupabaseConfigured()) {
    throw new ServiceError(
      "Supabase is not configured.",
      "SUPABASE_NOT_CONFIGURED",
      503,
    );
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(DB_TABLES.importHistory)
    .insert({
      manufacturer: input.manufacturer,
      started_at: input.startedAt,
      status: "running",
    })
    .select()
    .single();

  if (error || !data) {
    throw new ServiceError(
      `Failed to create import history record: ${error?.message ?? "unknown error"}`,
      "IMPORT_HISTORY_CREATE_FAILED",
      500,
    );
  }

  return data as ImportHistoryRow;
}

/** Updates an import_history row with final counts and status. */
export async function finalizeImportHistoryRecord(
  input: FinalizeImportHistoryInput,
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = requireSupabase();
  const { error } = await supabase
    .from(DB_TABLES.importHistory)
    .update({
      finished_at: input.finishedAt,
      status: input.status,
      imported: input.imported,
      updated: input.updated,
      skipped: input.skipped,
      ignored: input.ignored,
      duration_seconds: input.durationSeconds,
      error_message: input.errorMessage ?? null,
    })
    .eq("id", input.id);

  if (error) {
    console.error("[import-history] Failed to finalize record:", error.message);
  }
}

/** Returns recent import history rows, newest first. */
export async function listImportHistory(
  limit = 50,
): Promise<ImportHistoryRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(DB_TABLES.importHistory)
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new ServiceError(
      `Failed to load import history: ${error.message}`,
      "IMPORT_HISTORY_READ_FAILED",
      500,
    );
  }

  return (data ?? []) as ImportHistoryRow[];
}

/** Returns the most recent import per manufacturer (for dashboard summary). */
export async function listLatestImportByManufacturer(): Promise<ImportHistoryRow[]> {
  const history = await listImportHistory(200);
  const latestByManufacturer = new Map<string, ImportHistoryRow>();

  for (const row of history) {
    if (!latestByManufacturer.has(row.manufacturer)) {
      latestByManufacturer.set(row.manufacturer, row);
    }
  }

  return Array.from(latestByManufacturer.values()).sort((a, b) =>
    a.manufacturer.localeCompare(b.manufacturer),
  );
}
