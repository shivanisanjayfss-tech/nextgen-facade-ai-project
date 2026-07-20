import type { ImportHistoryAnalytics } from "@/types/import-analytics";
import { formatImportDuration } from "@/lib/import-history-display";

interface ImportHistorySummaryCardsProps {
  analytics: ImportHistoryAnalytics | null;
  isLoading?: boolean;
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-white/40">{hint}</p>}
    </div>
  );
}

/** Analytics summary cards for the import history dashboard. */
export function ImportHistorySummaryCards({
  analytics,
  isLoading = false,
}: ImportHistorySummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]"
          />
        ))}
      </div>
    );
  }

  if (!analytics) return null;

  const slowest = analytics.slowestManufacturers[0];

  return (
    <div className="mb-8 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard
          label="Success Rate"
          value={
            analytics.successRate === null ? "N/A" : `${analytics.successRate}%`
          }
          hint={`${analytics.filteredCount} run(s) in view`}
        />
        <SummaryCard
          label="Total Imported"
          value={String(analytics.totals.imported)}
        />
        <SummaryCard
          label="Total Updated"
          value={String(analytics.totals.updated)}
        />
        <SummaryCard
          label="Total Failed"
          value={String(analytics.totals.failed)}
          hint={`${analytics.failedRunCount} failed run(s)`}
        />
        <SummaryCard
          label="Avg Duration"
          value={formatImportDuration(analytics.averageDurationSeconds)}
        />
        <SummaryCard
          label="Slowest"
          value={slowest ? formatImportDuration(slowest.durationSeconds) : "—"}
          hint={slowest ? slowest.manufacturer : "No completed runs"}
        />
      </div>

      {analytics.slowestManufacturers.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-white/45">
            Slowest manufacturers
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/70">
            {analytics.slowestManufacturers.map((entry) => (
              <li key={entry.importHistoryId}>
                <span className="font-medium text-white">{entry.manufacturer}</span>
                {" · "}
                {formatImportDuration(entry.durationSeconds)}
                {" · "}
                <span className="capitalize text-white/50">{entry.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
