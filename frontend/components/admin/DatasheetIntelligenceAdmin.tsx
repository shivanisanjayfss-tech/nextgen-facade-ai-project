"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { statusBadgeClass } from "@/lib/datasheet-intelligence-display";
import type { ApiResponse } from "@/types";
import type { DatasheetIntelligence } from "@/types/datasheet-intelligence";

/** Admin list for datasheet intelligence processing and review. */
export function DatasheetIntelligenceAdmin() {
  const [items, setItems] = useState<DatasheetIntelligence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/datasheets/intelligence/review?limit=100");
      const json = (await response.json()) as ApiResponse<{ items: DatasheetIntelligence[] }>;

      if (!response.ok || !json.success) {
        throw new Error(json.success ? "Failed to load" : json.error.message);
      }

      setItems(json.data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load datasheet intelligence");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const processPending = async () => {
    setIsProcessing(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/datasheets/intelligence/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10 }),
      });
      const json = (await response.json()) as ApiResponse<{
        results: Array<{ materialId: string; status: string }>;
      }>;

      if (!response.ok || !json.success) {
        throw new Error(json.success ? "Processing failed" : json.error.message);
      }

      const completed = json.data.results.filter((row) => row.status === "completed").length;
      setMessage(`Processed ${json.data.results.length} datasheet(s). ${completed} completed.`);
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Datasheet Intelligence"
        description="AI extraction pipeline for imported PDF datasheets — review, edit, and reprocess."
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadItems()} disabled={isLoading}>
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void processPending()}
              disabled={isProcessing}
            >
              {isProcessing ? "Processing…" : "Process Pending (10)"}
            </Button>
          </div>
        }
      />

      {isLoading && (
        <Card>
          <LoadingSpinner size="lg" label="Loading datasheet rows…" className="py-8" />
        </Card>
      )}

      {error && !isLoading && <ErrorMessage message={error} onRetry={() => void loadItems()} />}

      {message && (
        <p className="mb-6 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200">
          {message}
        </p>
      )}

      {!isLoading && !error && (
        <Card>
          <CardHeader>
            <CardTitle>Intelligence Records</CardTitle>
            <CardDescription>
              Rows are auto-queued when materials gain a datasheet URL during import.
            </CardDescription>
          </CardHeader>

          {items.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-white/50">No datasheet intelligence records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/50">
                    <th className="px-6 py-3 font-medium">Material</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Fire Rating</th>
                    <th className="px-6 py-3 font-medium">Thickness</th>
                    <th className="px-6 py-3 font-medium">Finish</th>
                    <th className="px-6 py-3 font-medium">Updated</th>
                    <th className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-white/5 text-white/70">
                      <td className="px-6 py-4 font-mono text-xs">{item.materialId.slice(0, 8)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs capitalize ${statusBadgeClass(item.status)}`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">{item.fireRating ?? "—"}</td>
                      <td className="px-6 py-4">{item.thickness ?? "—"}</td>
                      <td className="px-6 py-4">{item.finish ?? "—"}</td>
                      <td className="px-6 py-4 text-xs text-white/40">
                        {new Date(item.updatedAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Link href={`/admin/datasheets/${item.materialId}`}>
                            <Button variant="outline" size="sm">
                              Review
                            </Button>
                          </Link>
                          <Link href={`/materials/${item.materialId}/datasheet`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                        </div>
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
