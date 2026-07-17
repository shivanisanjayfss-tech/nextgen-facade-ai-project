import type { ImportHistoryFilters, ImportHistoryPresetFilter } from "@/types/import-analytics";
import type { ImportHistoryRow, ImportHistoryStatus } from "@/types/import-history";

const VALID_STATUSES = new Set<ImportHistoryStatus>([
  "running",
  "succeeded",
  "failed",
  "partial",
]);

const VALID_PRESETS = new Set<ImportHistoryPresetFilter>([
  "zero_products",
  "updated_only",
]);

function parseIsoDate(value: string | null, param: string): string | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Query param '${param}' must be a valid ISO date.`);
  }
  return new Date(parsed).toISOString();
}

/** Parses import history filter query params from a request URL. */
export function parseImportHistoryFilters(
  searchParams: URLSearchParams,
): ImportHistoryFilters {
  const filters: ImportHistoryFilters = {};

  const status = searchParams.get("status")?.trim();
  if (status) {
    if (!VALID_STATUSES.has(status as ImportHistoryStatus)) {
      throw new Error(
        `Query param 'status' must be one of: ${[...VALID_STATUSES].join(", ")}.`,
      );
    }
    filters.status = status as ImportHistoryStatus;
  }

  const manufacturer = searchParams.get("manufacturer")?.trim();
  if (manufacturer) filters.manufacturer = manufacturer;

  const trigger = searchParams.get("trigger")?.trim();
  if (trigger) filters.trigger = trigger;

  const batchId = searchParams.get("batchId")?.trim() ?? searchParams.get("schedulerRunId")?.trim();
  if (batchId) filters.batchId = batchId;

  filters.from = parseIsoDate(searchParams.get("from"), "from");
  filters.to = parseIsoDate(searchParams.get("to"), "to");

  const preset = searchParams.get("preset")?.trim();
  if (preset) {
    if (!VALID_PRESETS.has(preset as ImportHistoryPresetFilter)) {
      throw new Error(
        `Query param 'preset' must be one of: ${[...VALID_PRESETS].join(", ")}.`,
      );
    }
    filters.preset = preset as ImportHistoryPresetFilter;
  }

  return filters;
}

/** Applies filters to in-memory import history rows. */
export function applyImportHistoryFilters(
  rows: ImportHistoryRow[],
  filters?: ImportHistoryFilters,
): ImportHistoryRow[] {
  if (!filters) return rows;

  return rows.filter((row) => {
    if (filters.status && row.status !== filters.status) return false;

    if (
      filters.manufacturer &&
      !row.manufacturer.toLowerCase().includes(filters.manufacturer.toLowerCase())
    ) {
      return false;
    }

    if (filters.trigger && row.trigger !== filters.trigger) return false;

    if (filters.batchId && row.scheduler_run_id !== filters.batchId) return false;

    if (filters.from && new Date(row.started_at).getTime() < new Date(filters.from).getTime()) {
      return false;
    }

    if (filters.to && new Date(row.started_at).getTime() > new Date(filters.to).getTime()) {
      return false;
    }

    if (filters.preset === "zero_products" && (row.extracted_products ?? 0) !== 0) {
      return false;
    }

    if (filters.preset === "updated_only" && !(row.imported === 0 && row.updated > 0)) {
      return false;
    }

    return true;
  });
}
