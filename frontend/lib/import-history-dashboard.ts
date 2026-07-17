import type { ImportHistoryPresetFilter } from "@/types/import-analytics";
import type { ImportHistoryRow, ImportHistoryStatus } from "@/types/import-history";

export type ImportHistoryViewMode = "all" | "latest" | "batches";

export type ImportHistoryStatusFilter = ImportHistoryStatus | "all";

export interface ImportHistoryUiFilter {
  status: ImportHistoryStatusFilter;
  preset?: ImportHistoryPresetFilter;
}

export function buildHistoryQueryParams(
  filter: ImportHistoryUiFilter,
  view: ImportHistoryViewMode,
  limit = 100,
): string {
  const params = new URLSearchParams();
  params.set("limit", String(limit));

  if (view === "latest") {
    params.set("view", "latest");
  }

  if (filter.status !== "all") {
    params.set("status", filter.status);
  }

  if (filter.preset) {
    params.set("preset", filter.preset);
  }

  return params.toString();
}

export function buildAnalyticsQueryParams(filter: ImportHistoryUiFilter): string {
  const params = new URLSearchParams();

  if (filter.status !== "all") {
    params.set("status", filter.status);
  }

  if (filter.preset) {
    params.set("preset", filter.preset);
  }

  return params.toString();
}

/** Client-side filter for latest-per-manufacturer view (API ignores filters on view=latest). */
export function applyClientHistoryFilter(
  rows: ImportHistoryRow[],
  filter: ImportHistoryUiFilter,
): ImportHistoryRow[] {
  return rows.filter((row) => {
    if (filter.status !== "all" && row.status !== filter.status) return false;
    if (filter.preset === "zero_products" && (row.extracted_products ?? 0) !== 0) {
      return false;
    }
    if (filter.preset === "updated_only" && !(row.imported === 0 && row.updated > 0)) {
      return false;
    }
    return true;
  });
}

export const HISTORY_FILTER_OPTIONS: Array<{
  id: string;
  label: string;
  filter: ImportHistoryUiFilter;
}> = [
  { id: "all", label: "All", filter: { status: "all" } },
  { id: "succeeded", label: "Succeeded", filter: { status: "succeeded" } },
  { id: "partial", label: "Partial", filter: { status: "partial" } },
  { id: "failed", label: "Failed", filter: { status: "failed" } },
  {
    id: "zero_products",
    label: "Zero Products",
    filter: { status: "all", preset: "zero_products" },
  },
  {
    id: "updated_only",
    label: "Updated Only",
    filter: { status: "all", preset: "updated_only" },
  },
];

export const VIEW_MODE_OPTIONS: Array<{ id: ImportHistoryViewMode; label: string }> = [
  { id: "all", label: "All Runs" },
  { id: "latest", label: "Latest Per Manufacturer" },
  { id: "batches", label: "Batch Runs" },
];
