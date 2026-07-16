import { ServiceError } from "@/lib/errors";
import {
  createMemoryImportHistoryId,
  getMemoryImportHistory,
  prependMemoryImportHistory,
  updateMemoryImportHistory,
} from "@/lib/import-history-memory";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import type { MaterialPersistDecision } from "@/types/import";
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
  failed: number;
  ignored: number;
  durationSeconds: number;
  extractedProducts?: number;
  productDecisions?: MaterialPersistDecision[];
  errorMessage?: string;
}

let useMemoryHistory = false;

function isMissingHistoryTable(message?: string): boolean {
  return Boolean(
    message?.includes("import_history") &&
      (message.includes("Could not find the table") ||
        message.includes("does not exist")),
  );
}

function isMissingProductDecisionsColumn(message?: string): boolean {
  return Boolean(
    message?.includes("product_decisions") ||
      message?.includes("extracted_products"),
  );
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

function normalizeImportHistoryRow(row: Partial<ImportHistoryRow>): ImportHistoryRow {
  return {
    id: row.id ?? createMemoryImportHistoryId(),
    manufacturer: row.manufacturer ?? "Unknown",
    started_at: row.started_at ?? new Date().toISOString(),
    finished_at: row.finished_at ?? null,
    status: row.status ?? "running",
    imported: row.imported ?? 0,
    updated: row.updated ?? 0,
    skipped: row.skipped ?? 0,
    failed: row.failed ?? 0,
    ignored: row.ignored ?? 0,
    duration_seconds: row.duration_seconds ?? null,
    error_message: row.error_message ?? null,
    product_decisions: row.product_decisions ?? [],
    extracted_products: row.extracted_products ?? 0,
  };
}

function createMemoryHistoryRow(input: CreateImportHistoryInput): ImportHistoryRow {
  return normalizeImportHistoryRow({
    id: createMemoryImportHistoryId(),
    manufacturer: input.manufacturer,
    started_at: input.startedAt,
    finished_at: null,
    status: "running",
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    ignored: 0,
    duration_seconds: null,
    error_message: null,
    product_decisions: [],
    extracted_products: 0,
  });
}

function buildFinalizePatch(input: FinalizeImportHistoryInput) {
  return {
    finished_at: input.finishedAt,
    status: input.status,
    imported: input.imported,
    updated: input.updated,
    skipped: input.skipped,
    failed: input.failed,
    ignored: input.ignored,
    duration_seconds: input.durationSeconds,
    error_message: input.errorMessage ?? null,
    product_decisions: input.productDecisions ?? [],
    extracted_products: input.extractedProducts ?? 0,
  };
}

/** Inserts a running import_history row at the start of a manufacturer import. */
export async function createImportHistoryRecord(
  input: CreateImportHistoryInput,
): Promise<ImportHistoryRow | null> {
  if (!isSupabaseConfigured() || useMemoryHistory) {
    const row = createMemoryHistoryRow(input);
    prependMemoryImportHistory(row);
    return row;
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(DB_TABLES.importHistory)
    .insert({
      manufacturer: input.manufacturer,
      started_at: input.startedAt,
      status: "running",
      product_decisions: [],
      extracted_products: 0,
    })
    .select()
    .single();

  if (error || !data) {
    const message = error?.message ?? "unknown error";
    if (isMissingHistoryTable(message)) {
      useMemoryHistory = true;
      console.warn(
        "[import-history] Table missing — using in-memory history until migration 004 is applied.",
      );
      const row = createMemoryHistoryRow(input);
      prependMemoryImportHistory(row);
      return row;
    }

    if (isMissingProductDecisionsColumn(message)) {
      const { data: legacyData, error: legacyError } = await supabase
        .from(DB_TABLES.importHistory)
        .insert({
          manufacturer: input.manufacturer,
          started_at: input.startedAt,
          status: "running",
        })
        .select()
        .single();

      if (!legacyError && legacyData) {
        return normalizeImportHistoryRow(legacyData as Partial<ImportHistoryRow>);
      }
    }

    throw new ServiceError(
      `Failed to create import history record: ${message}`,
      "IMPORT_HISTORY_CREATE_FAILED",
      500,
    );
  }

  return normalizeImportHistoryRow(data as Partial<ImportHistoryRow>);
}

/** Updates an import_history row with final counts and status. */
export async function finalizeImportHistoryRecord(
  input: FinalizeImportHistoryInput,
): Promise<void> {
  const patch = buildFinalizePatch(input);

  if (!isSupabaseConfigured() || useMemoryHistory) {
    updateMemoryImportHistory(input.id, patch);
    return;
  }

  const supabase = requireSupabase();

  let { error } = await supabase
    .from(DB_TABLES.importHistory)
    .update(patch)
    .eq("id", input.id);

  if (error?.message?.includes("failed") && error.message.includes("does not exist")) {
    const { failed: _failed, ...legacyPayload } = patch;
    ({ error } = await supabase
      .from(DB_TABLES.importHistory)
      .update(legacyPayload)
      .eq("id", input.id));
  }

  if (error && isMissingProductDecisionsColumn(error.message)) {
    const {
      product_decisions: _pd,
      extracted_products: _ep,
      ...legacyPayload
    } = patch;
    ({ error } = await supabase
      .from(DB_TABLES.importHistory)
      .update(legacyPayload)
      .eq("id", input.id));

    updateMemoryImportHistory(input.id, {
      product_decisions: patch.product_decisions,
      extracted_products: patch.extracted_products,
    });
  }

  if (error) {
    if (isMissingHistoryTable(error.message)) {
      useMemoryHistory = true;
      updateMemoryImportHistory(input.id, patch);
      return;
    }

    console.error("[import-history] Failed to finalize record:", error.message);
    updateMemoryImportHistory(input.id, patch);
  }
}

function mergeHistoryRows(rows: ImportHistoryRow[]): ImportHistoryRow[] {
  const byId = new Map<string, ImportHistoryRow>();

  for (const row of rows.map((entry) => normalizeImportHistoryRow(entry))) {
    const existing = byId.get(row.id);
    if (!existing || (row.product_decisions?.length ?? 0) > (existing.product_decisions?.length ?? 0)) {
      byId.set(row.id, row);
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
  );
}

/** Returns recent import history rows, newest first. */
export async function listImportHistory(
  limit = 50,
): Promise<ImportHistoryRow[]> {
  const memoryRows = getMemoryImportHistory().map((row) =>
    normalizeImportHistoryRow(row),
  );

  if (!isSupabaseConfigured() || useMemoryHistory) {
    return memoryRows.slice(0, limit);
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(DB_TABLES.importHistory)
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingHistoryTable(error.message)) {
      useMemoryHistory = true;
      return memoryRows.slice(0, limit);
    }

    throw new ServiceError(
      `Failed to load import history: ${error.message}`,
      "IMPORT_HISTORY_READ_FAILED",
      500,
    );
  }

  return mergeHistoryRows([
    ...memoryRows,
    ...((data ?? []) as ImportHistoryRow[]),
  ]).slice(0, limit);
}

/** Returns a single import history row with per-product decisions. */
export async function getImportHistoryById(
  id: string,
): Promise<ImportHistoryRow | null> {
  const memoryMatch = getMemoryImportHistory().find((row) => row.id === id);

  if (!isSupabaseConfigured() || useMemoryHistory) {
    return memoryMatch ? normalizeImportHistoryRow(memoryMatch) : null;
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(DB_TABLES.importHistory)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (isMissingHistoryTable(error.message)) {
      useMemoryHistory = true;
      return memoryMatch ? normalizeImportHistoryRow(memoryMatch) : null;
    }

    throw new ServiceError(
      `Failed to load import history: ${error.message}`,
      "IMPORT_HISTORY_READ_FAILED",
      500,
    );
  }

  if (!data) {
    return memoryMatch ? normalizeImportHistoryRow(memoryMatch) : null;
  }

  const normalized = normalizeImportHistoryRow(data as Partial<ImportHistoryRow>);
  if (
    memoryMatch &&
    (memoryMatch.product_decisions?.length ?? 0) >
      (normalized.product_decisions?.length ?? 0)
  ) {
    return normalizeImportHistoryRow({
      ...normalized,
      product_decisions: memoryMatch.product_decisions,
      extracted_products:
        memoryMatch.extracted_products ?? normalized.extracted_products,
    });
  }

  return normalized;
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
