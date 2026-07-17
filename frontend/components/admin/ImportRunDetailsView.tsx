"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ImportRunDiagnosticsTabs } from "@/components/admin/import-history/ImportRunDiagnosticsTabs";
import { PageHeader } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  formatBatchId,
  formatCrawlStatus,
  formatImportDate,
  formatImportDuration,
  formatTriggerLabel,
  statusBadgeClass,
} from "@/lib/import-history-display";
import type { ApiResponse } from "@/types";
import type { ImportRunEventRow } from "@/types/import-diagnostics";
import type { ImportHistoryRow } from "@/types/import-history";

interface RunDetailsResponse {
  run: ImportHistoryRow;
  events?: ImportRunEventRow[];
}

function SummaryStat({
  label,
  value,
  isStatus,
  statusKey,
}: {
  label: string;
  value: string;
  isStatus?: boolean;
  statusKey?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-white/45">{label}</p>
      {isStatus && statusKey ? (
        <span
          className={`mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(statusKey)}`}
        >
          {value}
        </span>
      ) : (
        <p className="mt-1 text-sm font-medium text-white">{value}</p>
      )}
    </div>
  );
}

export function ImportRunDetailsView({ runId }: { runId: string }) {
  const [run, setRun] = useState<ImportHistoryRow | null>(null);
  const [events, setEvents] = useState<ImportRunEventRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRun = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/import/history/${encodeURIComponent(runId)}?includeEvents=true`,
      );
      const json = (await response.json()) as ApiResponse<RunDetailsResponse>;

      if (!response.ok || !json.success) {
        throw new Error(json.success ? "Failed to load import run" : json.error.message);
      }

      setRun(json.data.run);
      setEvents(json.data.events ?? []);
    } catch (err) {
      setRun(null);
      setEvents([]);
      setError(err instanceof Error ? err.message : "Failed to load import run");
    } finally {
      setIsLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    void loadRun();
  }, [loadRun]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link
          href="/admin/import-history"
          className="text-sm text-sky-300 transition-colors hover:text-sky-200 hover:underline"
        >
          ← Back to Import History
        </Link>
        {run?.scheduler_run_id && (
          <Link
            href={`/admin/import-history/batches/${encodeURIComponent(run.scheduler_run_id)}`}
            className="text-sm text-white/50 transition-colors hover:text-white/70 hover:underline"
          >
            View batch {formatBatchId(run.scheduler_run_id)}
          </Link>
        )}
      </div>

      <PageHeader
        title="Import Run Details"
        description="Manufacturer import diagnostics, crawl timeline, and per-product decisions."
        action={
          <Button variant="outline" size="sm" onClick={() => void loadRun()} disabled={isLoading}>
            Refresh
          </Button>
        }
      />

      {isLoading && (
        <Card className="mb-8">
          <LoadingSpinner size="lg" label="Loading import run…" className="py-8" />
        </Card>
      )}

      {error && !isLoading && (
        <ErrorMessage message={error} onRetry={() => void loadRun()} className="mb-8" />
      )}

      {!isLoading && !error && run && (
        <>
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{run.manufacturer}</CardTitle>
              <CardDescription>
                Run {run.id.slice(0, 8)} · started {formatImportDate(run.started_at)}
              </CardDescription>
            </CardHeader>

            <div className="grid gap-4 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryStat label="Status" value={run.status} isStatus statusKey={run.status} />
              <SummaryStat label="Trigger" value={formatTriggerLabel(run.trigger)} />
              <SummaryStat label="Crawl Status" value={formatCrawlStatus(run.crawl_status)} />
              <SummaryStat label="Pages Crawled" value={String(run.crawled_pages ?? 0)} />
              <SummaryStat label="Extracted" value={String(run.extracted_products)} />
              <SummaryStat label="Imported" value={String(run.imported)} />
              <SummaryStat label="Updated" value={String(run.updated)} />
              <SummaryStat label="Skipped" value={String(run.skipped)} />
              <SummaryStat label="Failed" value={String(run.failed)} />
              <SummaryStat label="Duration" value={formatImportDuration(run.duration_seconds)} />
              <SummaryStat label="Finished" value={formatImportDate(run.finished_at)} />
              <SummaryStat
                label="Batch"
                value={run.scheduler_run_id ? formatBatchId(run.scheduler_run_id) : "—"}
              />
            </div>

            {run.apify_run_url && (
              <p className="mx-6 mb-4 text-sm text-white/60">
                Apify:{" "}
                <a
                  href={run.apify_run_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-300 hover:underline"
                >
                  {run.apify_run_url}
                </a>
              </p>
            )}

            {run.error_message && (
              <p className="mx-6 mb-6 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-200">
                {run.error_message}
              </p>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Diagnostics</CardTitle>
              <CardDescription>
                Products, crawl timeline, ignored pages, URLs, and structured pipeline logs.
              </CardDescription>
            </CardHeader>

            <ImportRunDiagnosticsTabs run={run} events={events} />
          </Card>
        </>
      )}
    </>
  );
}
