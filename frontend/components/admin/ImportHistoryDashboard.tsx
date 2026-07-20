"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilterChip } from "@/components/admin/import-history/FilterChip";
import { ImportBatchRunsTable } from "@/components/admin/import-history/ImportBatchRunsTable";
import { ImportHistoryRunsTable } from "@/components/admin/import-history/ImportHistoryRunsTable";
import { ImportHistorySummaryCards } from "@/components/admin/import-history/ImportHistorySummaryCards";
import { PageHeader } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  applyBatchFilter,
  computeBatchAnalytics,
  computeHistoryAnalytics,
} from "@/lib/import-history-analytics";
import {
  applyClientHistoryFilter,
  buildHistoryQueryParams,
  HISTORY_FILTER_OPTIONS,
  VIEW_MODE_OPTIONS,
  type ImportHistoryViewMode,
} from "@/lib/import-history-dashboard";
import type { ApiResponse } from "@/types";
import type { ImportBatchSummary } from "@/types/import-analytics";
import type { ImportHistoryRow } from "@/types/import-history";

interface HistoryResponse {
  history: ImportHistoryRow[];
}

interface BatchesResponse {
  batches: ImportBatchSummary[];
}

function extractBatches(data: BatchesResponse | ImportBatchSummary[] | null | undefined): ImportBatchSummary[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.batches)) return data.batches;
  return [];
}

export function ImportHistoryDashboard() {
  const [viewMode, setViewMode] = useState<ImportHistoryViewMode>("all");
  const [activeFilterId, setActiveFilterId] = useState("all");
  const [history, setHistory] = useState<ImportHistoryRow[]>([]);
  const [batches, setBatches] = useState<ImportBatchSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeFilter = useMemo(
    () =>
      HISTORY_FILTER_OPTIONS.find((option) => option.id === activeFilterId)?.filter ?? {
        status: "all" as const,
      },
    [activeFilterId],
  );

  const requestIdRef = useRef(0);
  const activeFilterRef = useRef(activeFilter);
  activeFilterRef.current = activeFilter;

  const displayedBatches = useMemo(
    () => applyBatchFilter(batches, activeFilter),
    [batches, activeFilter],
  );

  const displayedHistory = useMemo(() => {
    if (viewMode === "latest") {
      return applyClientHistoryFilter(history, activeFilter);
    }
    return history;
  }, [history, activeFilter, viewMode]);

  // Analytics always mirrors the exact rows shown in the table (single source of truth).
  const analytics = useMemo(() => {
    if (viewMode === "batches") {
      return computeBatchAnalytics(displayedBatches, activeFilter);
    }
    return computeHistoryAnalytics(displayedHistory, activeFilter);
  }, [viewMode, displayedBatches, displayedHistory, activeFilter]);

  const loadDashboard = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const filter = activeFilterRef.current;
    setIsLoading(true);
    setError(null);

    try {
      if (viewMode === "batches") {
        const response = await fetch("/api/import/history/batches?limit=50");
        const json = (await response.json()) as ApiResponse<BatchesResponse>;

        if (!response.ok || !json.success) {
          throw new Error(json.success ? "Failed to load batches" : json.error.message);
        }

        // Ignore stale responses from an older viewMode fetch.
        if (requestId !== requestIdRef.current) return;

        const nextBatches = extractBatches(json.data);
        // TEMP debug — remove after confirming Batch Runs rows render
        console.log("[ImportHistoryDashboard] batches.length", nextBatches.length);
        console.log("[ImportHistoryDashboard] first batch", nextBatches[0] ?? null);

        setBatches(nextBatches);
        setHistory([]);
      } else {
        const historyQuery = buildHistoryQueryParams(filter, viewMode);
        const response = await fetch(`/api/import/history?${historyQuery}`);
        const json = (await response.json()) as ApiResponse<HistoryResponse>;

        if (!response.ok || !json.success) {
          throw new Error(json.success ? "Failed to load history" : json.error.message);
        }

        if (requestId !== requestIdRef.current) return;

        setHistory(Array.isArray(json.data.history) ? json.data.history : []);
        setBatches([]);
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load import history");
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [viewMode]);

  // Batch filters are client-side only. Refetch history when its server filters change.
  const historyFilterKey = viewMode === "batches" ? "" : JSON.stringify(activeFilter);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard, historyFilterKey]);

  const tableTitle =
    viewMode === "batches"
      ? "Batch runs"
      : viewMode === "latest"
        ? "Latest run per manufacturer"
        : "All import runs";

  const visibleCount =
    viewMode === "batches" ? displayedBatches.length : displayedHistory.length;

  const tableDescription =
    viewMode === "batches"
      ? `${visibleCount} batch run(s) match the current filters. Open a batch to see linked manufacturer runs.`
      : `${visibleCount} run(s) match the current filters. Open a run for product-level diagnostics.`;

  return (
    <>
      <PageHeader
        title="Import History"
        description="Diagnostics dashboard for scheduled and manual manufacturer imports."
      />

      <ImportHistorySummaryCards analytics={analytics} isLoading={isLoading} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-white/40">View</span>
        {VIEW_MODE_OPTIONS.map((option) => (
          <FilterChip
            key={option.id}
            label={option.label}
            active={viewMode === option.id}
            onClick={() => setViewMode(option.id)}
          />
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-white/40">Filter</span>
        {HISTORY_FILTER_OPTIONS.map((option) => (
          <FilterChip
            key={option.id}
            label={option.label}
            active={activeFilterId === option.id}
            onClick={() => setActiveFilterId(option.id)}
          />
        ))}
      </div>

      <div className="mb-6 flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => void loadDashboard()} disabled={isLoading}>
          Refresh
        </Button>
        <Link
          href="/admin/import"
          className="text-sm text-sky-300 transition-colors hover:text-sky-200 hover:underline"
        >
          Go to Import & Scheduler
        </Link>
      </div>

      {isLoading && (
        <Card className="mb-8">
          <LoadingSpinner size="lg" label="Loading import history…" className="py-8" />
        </Card>
      )}

      {error && !isLoading && (
        <ErrorMessage message={error} onRetry={() => void loadDashboard()} className="mb-8" />
      )}

      {!isLoading && !error && (
        <Card>
          <CardHeader>
            <CardTitle>{tableTitle}</CardTitle>
            <CardDescription>{tableDescription}</CardDescription>
          </CardHeader>

          {viewMode === "batches" ? (
            displayedBatches.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-white/50">
                No batch runs match the current filters. Try a different filter or run an import
                from the{" "}
                <Link href="/admin/import" className="text-sky-300 hover:underline">
                  Admin Import
                </Link>{" "}
                page.
              </p>
            ) : (
              <ImportBatchRunsTable batches={displayedBatches} />
            )
          ) : displayedHistory.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-white/50">
              No import history matches the current filters. Try a different filter or run an import
              from the{" "}
              <Link href="/admin/import" className="text-sky-300 hover:underline">
                Admin Import
              </Link>{" "}
              page.
            </p>
          ) : (
            <ImportHistoryRunsTable rows={displayedHistory} />
          )}
        </Card>
      )}
    </>
  );
}
