"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  applyClientHistoryFilter,
  buildAnalyticsQueryParams,
  buildHistoryQueryParams,
  HISTORY_FILTER_OPTIONS,
  VIEW_MODE_OPTIONS,
  type ImportHistoryUiFilter,
  type ImportHistoryViewMode,
} from "@/lib/import-history-dashboard";
import type { ApiResponse } from "@/types";
import type { ImportBatchSummary, ImportHistoryAnalytics } from "@/types/import-analytics";
import type { ImportHistoryRow } from "@/types/import-history";

interface HistoryResponse {
  history: ImportHistoryRow[];
}

interface AnalyticsResponse {
  analytics: ImportHistoryAnalytics;
}

interface BatchesResponse {
  batches: ImportBatchSummary[];
}

export function ImportHistoryDashboard() {
  const [viewMode, setViewMode] = useState<ImportHistoryViewMode>("all");
  const [activeFilterId, setActiveFilterId] = useState("all");
  const [history, setHistory] = useState<ImportHistoryRow[]>([]);
  const [batches, setBatches] = useState<ImportBatchSummary[]>([]);
  const [analytics, setAnalytics] = useState<ImportHistoryAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeFilter = useMemo(
    () =>
      HISTORY_FILTER_OPTIONS.find((option) => option.id === activeFilterId)?.filter ?? {
        status: "all" as const,
      },
    [activeFilterId],
  );

  const displayedHistory = useMemo(() => {
    if (viewMode === "latest") {
      return applyClientHistoryFilter(history, activeFilter);
    }
    return history;
  }, [history, activeFilter, viewMode]);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const analyticsQuery = buildAnalyticsQueryParams(activeFilter);
      const analyticsUrl = analyticsQuery
        ? `/api/import/history/analytics?${analyticsQuery}`
        : "/api/import/history/analytics";

      const requests: Promise<void>[] = [
        fetch(analyticsUrl)
          .then(async (response) => {
            const json = (await response.json()) as ApiResponse<AnalyticsResponse>;
            if (!response.ok || !json.success) {
              throw new Error(json.success ? "Failed to load analytics" : json.error.message);
            }
            setAnalytics(json.data.analytics);
          }),
      ];

      if (viewMode === "batches") {
        requests.push(
          fetch("/api/import/history/batches?limit=50")
            .then(async (response) => {
              const json = (await response.json()) as ApiResponse<BatchesResponse>;
              if (!response.ok || !json.success) {
                throw new Error(json.success ? "Failed to load batches" : json.error.message);
              }
              setBatches(json.data.batches);
            }),
        );
        setHistory([]);
      } else {
        const historyQuery = buildHistoryQueryParams(activeFilter, viewMode);
        requests.push(
          fetch(`/api/import/history?${historyQuery}`)
            .then(async (response) => {
              const json = (await response.json()) as ApiResponse<HistoryResponse>;
              if (!response.ok || !json.success) {
                throw new Error(json.success ? "Failed to load history" : json.error.message);
              }
              setHistory(json.data.history);
            }),
        );
        setBatches([]);
      }

      await Promise.all(requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load import history");
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, viewMode]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const tableTitle =
    viewMode === "batches"
      ? "Batch runs"
      : viewMode === "latest"
        ? "Latest run per manufacturer"
        : "All import runs";

  const tableDescription =
    viewMode === "batches"
      ? `${batches.length} scheduler batch(es). Open a batch to see linked manufacturer runs.`
      : `${displayedHistory.length} run(s) in the current view. Open a run for product-level diagnostics.`;

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
            batches.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-white/50">
                No batch runs yet. Use <strong>Run Now</strong> on the{" "}
                <Link href="/admin/import" className="text-sky-300 hover:underline">
                  Admin Import
                </Link>{" "}
                page.
              </p>
            ) : (
              <ImportBatchRunsTable batches={batches} />
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
