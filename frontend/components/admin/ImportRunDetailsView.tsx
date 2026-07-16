"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { ApiResponse } from "@/types";
import type {
  MaterialPersistDecision,
  MaterialPersistOutcome,
} from "@/types/import";
import type { ImportHistoryRow } from "@/types/import-history";

interface RunDetailsResponse {
  run: ImportHistoryRow;
}

const RUN_STATUS_STYLES: Record<string, string> = {
  succeeded: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
  failed: "text-red-300 bg-red-400/10 border-red-400/20",
  partial: "text-amber-300 bg-amber-400/10 border-amber-400/20",
  running: "text-sky-300 bg-sky-400/10 border-sky-400/20",
};

const OUTCOME_STYLES: Record<MaterialPersistOutcome, string> = {
  imported: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
  updated: "text-sky-300 bg-sky-400/10 border-sky-400/20",
  skipped: "text-amber-300 bg-amber-400/10 border-amber-400/20",
  failed: "text-red-300 bg-red-400/10 border-red-400/20",
};

const OUTCOME_LABELS: Record<MaterialPersistOutcome, string> = {
  imported: "Imported",
  updated: "Updated",
  skipped: "Skipped",
  failed: "Failed",
};

type OutcomeFilter = "all" | MaterialPersistOutcome;

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

function formatChangedFields(decision: MaterialPersistDecision): string {
  if (decision.changedFields.length === 0) return "—";
  return decision.changedFields
    .map((change) => `${change.field}: ${change.previous} → ${change.next}`)
    .join("; ");
}

export function ImportRunDetailsView({ runId }: { runId: string }) {
  const [run, setRun] = useState<ImportHistoryRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");

  const loadRun = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/import/history/${encodeURIComponent(runId)}`);
      const json = (await response.json()) as ApiResponse<RunDetailsResponse>;

      if (!response.ok || !json.success) {
        throw new Error(json.success ? "Failed to load import run" : json.error.message);
      }

      setRun(json.data.run);
    } catch (err) {
      setRun(null);
      setError(err instanceof Error ? err.message : "Failed to load import run");
    } finally {
      setIsLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    void loadRun();
  }, [loadRun]);

  const decisions = run?.product_decisions ?? [];

  const outcomeCounts = useMemo(() => {
    const counts: Record<MaterialPersistOutcome, number> = {
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };

    for (const decision of decisions) {
      counts[decision.outcome] += 1;
    }

    return counts;
  }, [decisions]);

  const filteredDecisions = useMemo(() => {
    if (outcomeFilter === "all") return decisions;
    return decisions.filter((decision) => decision.outcome === outcomeFilter);
  }, [decisions, outcomeFilter]);

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
        title="Import Run Details"
        description="Per-product import decisions for debugging and auditing."
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
                Run {run.id} · started {formatDate(run.started_at)}
              </CardDescription>
            </CardHeader>

            <div className="grid gap-4 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryStat label="Status" value={run.status} isStatus statusKey={run.status} />
              <SummaryStat label="Extracted" value={String(run.extracted_products)} />
              <SummaryStat label="Imported" value={String(run.imported)} />
              <SummaryStat label="Updated" value={String(run.updated)} />
              <SummaryStat label="Skipped" value={String(run.skipped)} />
              <SummaryStat label="Failed" value={String(run.failed)} />
              <SummaryStat label="Duration" value={formatDuration(run.duration_seconds)} />
              <SummaryStat label="Finished" value={formatDate(run.finished_at)} />
            </div>

            {run.error_message && (
              <p className="mx-6 mb-6 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-200">
                {run.error_message}
              </p>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Processed products</CardTitle>
              <CardDescription>
                {decisions.length > 0
                  ? `${decisions.length} product(s) with recorded decisions.`
                  : "No per-product decisions were stored for this run. Re-run the import after migration 010 is applied."}
              </CardDescription>
            </CardHeader>

            {decisions.length > 0 && (
              <div className="flex flex-wrap gap-2 px-6 pb-4">
                <FilterButton
                  label={`All (${decisions.length})`}
                  active={outcomeFilter === "all"}
                  onClick={() => setOutcomeFilter("all")}
                />
                {(Object.keys(OUTCOME_LABELS) as MaterialPersistOutcome[]).map((outcome) => (
                  <FilterButton
                    key={outcome}
                    label={`${OUTCOME_LABELS[outcome]} (${outcomeCounts[outcome]})`}
                    active={outcomeFilter === outcome}
                    onClick={() => setOutcomeFilter(outcome)}
                  />
                ))}
              </div>
            )}

            {decisions.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-white/50">
                Totals only: imported {run.imported}, updated {run.updated}, skipped{" "}
                {run.skipped}, failed {run.failed}.
              </p>
            ) : filteredDecisions.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-white/50">
                No products match the selected filter.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50">
                      <th className="px-6 py-3 font-medium">Product</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Reasons</th>
                      <th className="px-6 py-3 font-medium">Match</th>
                      <th className="px-6 py-3 font-medium">Changed fields</th>
                      <th className="px-6 py-3 font-medium">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDecisions.map((decision) => (
                      <tr
                        key={`${decision.slug}-${decision.sourceUrl}`}
                        className="border-b border-white/5 align-top text-white/70 transition-colors hover:bg-white/[0.02]"
                      >
                        <td className="px-6 py-4">
                          <p className="font-medium text-white">{decision.productName}</p>
                          <p className="mt-1 text-xs text-white/40">{decision.slug}</p>
                          {decision.sourceUrl && (
                            <a
                              href={decision.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 block max-w-xs truncate text-xs text-sky-300 hover:underline"
                            >
                              {decision.sourceUrl}
                            </a>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                              OUTCOME_STYLES[decision.outcome]
                            }`}
                          >
                            {OUTCOME_LABELS[decision.outcome]}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <ul className="space-y-1">
                            {(decision.statusReasons.length > 0
                              ? decision.statusReasons
                              : [decision.reason]
                            ).map((reason) => (
                              <li key={reason} className="text-xs text-white/60">
                                {reason}
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="px-6 py-4 text-xs text-white/50">
                          {decision.matchKind}
                        </td>
                        <td className="px-6 py-4 text-xs text-white/50">
                          {formatChangedFields(decision)}
                        </td>
                        <td className="px-6 py-4 text-xs text-red-200">
                          {decision.errorMessage ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
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
          className={`mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
            RUN_STATUS_STYLES[statusKey] ?? RUN_STATUS_STYLES.partial
          }`}
        >
          {value}
        </span>
      ) : (
        <p className="mt-1 text-sm font-medium text-white">{value}</p>
      )}
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
          : "border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20 hover:text-white/70"
      }`}
    >
      {label}
    </button>
  );
}
