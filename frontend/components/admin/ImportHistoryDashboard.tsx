"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { ApiResponse } from "@/types";
import type { ImportHistoryRow } from "@/types/import-history";

interface HistoryResponse {
  history: ImportHistoryRow[];
}

const STATUS_STYLES: Record<string, string> = {
  succeeded: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
  failed: "text-red-300 bg-red-400/10 border-red-400/20",
  partial: "text-amber-300 bg-amber-400/10 border-amber-400/20",
  running: "text-sky-300 bg-sky-400/10 border-sky-400/20",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

export function ImportHistoryDashboard() {
  const [history, setHistory] = useState<ImportHistoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/import/history?limit=100");
      const json = (await response.json()) as ApiResponse<HistoryResponse>;

      if (!response.ok || !json.success) {
        throw new Error(json.success ? "Failed to load history" : json.error.message);
      }

      setHistory(json.data.history);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load import history");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  return (
    <>
      <PageHeader
        title="Import History"
        description="Automatic manufacturer import runs — triggered by the monthly scheduler or manual Run Now."
      />

      <div className="mb-6 flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => void loadHistory()} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      {isLoading && (
        <Card className="mb-8">
          <LoadingSpinner size="lg" label="Loading import history…" className="py-8" />
        </Card>
      )}

      {error && !isLoading && (
        <ErrorMessage message={error} onRetry={() => void loadHistory()} className="mb-8" />
      )}

      {!isLoading && !error && (
        <Card>
          <CardHeader>
            <CardTitle>Recent import runs</CardTitle>
            <CardDescription>
              {history.length} run(s). Open a run to see every processed product and its status.
            </CardDescription>
          </CardHeader>

          {history.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-white/50">
              No import history yet. Use <strong>Run Now</strong> on the{" "}
              <Link href="/admin/import" className="text-sky-300 hover:underline">
                Admin Import
              </Link>{" "}
              page or wait for the monthly scheduler.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/50">
                    <th className="px-6 py-3 font-medium">Manufacturer</th>
                    <th className="px-6 py-3 font-medium">Started</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium text-right">Products</th>
                    <th className="px-6 py-3 font-medium text-right">Imported</th>
                    <th className="px-6 py-3 font-medium text-right">Updated</th>
                    <th className="px-6 py-3 font-medium text-right">Skipped</th>
                    <th className="px-6 py-3 font-medium text-right">Failed</th>
                    <th className="px-6 py-3 font-medium text-right">Duration</th>
                    <th className="px-6 py-3 font-medium text-right">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-white/5 text-white/70 transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-6 py-4 font-medium text-white">{row.manufacturer}</td>
                      <td className="px-6 py-4">{formatDate(row.started_at)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
                            STATUS_STYLES[row.status] ?? STATUS_STYLES.partial
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums">
                        {row.product_decisions?.length ?? row.extracted_products ?? 0}
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums">{row.imported}</td>
                      <td className="px-6 py-4 text-right tabular-nums">{row.updated}</td>
                      <td className="px-6 py-4 text-right tabular-nums">{row.skipped}</td>
                      <td className="px-6 py-4 text-right tabular-nums">{row.failed}</td>
                      <td className="px-6 py-4 text-right tabular-nums">
                        {formatDuration(row.duration_seconds)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/admin/import-history/${encodeURIComponent(row.id)}`}
                          className="text-sm font-medium text-sky-300 hover:text-sky-200 hover:underline"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
