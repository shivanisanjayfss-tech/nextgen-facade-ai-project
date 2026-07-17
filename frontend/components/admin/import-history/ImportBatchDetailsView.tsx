"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ImportBatchManufacturersTable } from "@/components/admin/import-history/ImportBatchManufacturersTable";
import { ImportBatchSummary } from "@/components/admin/import-history/ImportBatchSummary";
import { StructuredLogsTable } from "@/components/admin/import-history/StructuredLogsTable";
import { PageHeader } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatImportDate, formatTriggerLabel } from "@/lib/import-history-display";
import type { ApiResponse } from "@/types";
import type { ImportBatchDetail } from "@/types/import-analytics";

interface ImportBatchDetailsViewProps {
  batchId: string;
}

/** Batch run detail page with summary, manufacturer table, and structured logs. */
export function ImportBatchDetailsView({ batchId }: ImportBatchDetailsViewProps) {
  const [detail, setDetail] = useState<ImportBatchDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBatch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/import/history/batches/${encodeURIComponent(batchId)}`,
      );
      const json = (await response.json()) as ApiResponse<ImportBatchDetail>;

      if (!response.ok || !json.success) {
        throw new Error(json.success ? "Failed to load batch" : json.error.message);
      }

      setDetail(json.data);
    } catch (err) {
      setDetail(null);
      setError(err instanceof Error ? err.message : "Failed to load batch");
    } finally {
      setIsLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    void loadBatch();
  }, [loadBatch]);

  const batch = detail?.batch;

  return (
    <>
      <div className="mb-6">
        <Link
          href="/admin/import-history"
          className="text-sm text-sky-300 transition-colors hover:text-sky-200 hover:underline"
        >
          ← Back to Import History
        </Link>
      </div>

      <PageHeader
        title="Batch Run Details"
        description="Scheduler batch summary, manufacturer outcomes, and structured pipeline logs."
        action={
          <Button variant="outline" size="sm" onClick={() => void loadBatch()} disabled={isLoading}>
            Refresh
          </Button>
        }
      />

      {isLoading && (
        <Card className="mb-8">
          <LoadingSpinner size="lg" label="Loading batch run…" className="py-8" />
        </Card>
      )}

      {error && !isLoading && (
        <ErrorMessage message={error} onRetry={() => void loadBatch()} className="mb-8" />
      )}

      {!isLoading && !error && batch && detail && (
        <>
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Batch Summary</CardTitle>
              <CardDescription>
                {formatTriggerLabel(batch.trigger)} · batch {batch.id.slice(0, 8)} · started{" "}
                {formatImportDate(batch.started_at)}
              </CardDescription>
            </CardHeader>

            <ImportBatchSummary batch={batch} manufacturers={detail.manufacturers} />

            {batch.error_message && (
              <p className="mx-6 mb-6 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-200">
                {batch.error_message}
              </p>
            )}
          </Card>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Manufacturers</CardTitle>
              <CardDescription>
                Click a manufacturer to open crawl diagnostics and per-product decisions.
              </CardDescription>
            </CardHeader>

            <ImportBatchManufacturersTable rows={detail.manufacturers} />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Structured Logs</CardTitle>
              <CardDescription>
                Full pipeline timeline for this batch — all persisted scheduler stages.
              </CardDescription>
            </CardHeader>

            <div className="px-6 pb-6">
              <StructuredLogsTable
                events={detail.events}
                showManufacturer
                showStageCoverage
              />
            </div>
          </Card>
        </>
      )}
    </>
  );
}
