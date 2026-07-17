import type { ReactNode } from "react";
import {
  formatImportDate,
  formatImportDuration,
  formatTriggerLabel,
  statusBadgeClass,
} from "@/lib/import-history-display";
import type { ImportSchedulerRunRow } from "@/types/import-diagnostics";
import type { ImportHistoryRow } from "@/types/import-history";

interface ImportBatchSummaryProps {
  batch: ImportSchedulerRunRow;
  manufacturers: ImportHistoryRow[];
}

function computeBatchSuccessRate(manufacturers: ImportHistoryRow[]): number {
  const terminal = manufacturers.filter((row) => row.status !== "running");
  if (terminal.length === 0) return 0;

  const succeeded = terminal.filter((row) => row.status === "succeeded").length;
  return Math.round((succeeded / terminal.length) * 1000) / 10;
}

/** Batch-level summary stats for the batch details page. */
export function ImportBatchSummary({ batch, manufacturers }: ImportBatchSummaryProps) {
  const successRate = computeBatchSuccessRate(manufacturers);

  return (
    <div className="grid gap-4 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <SummaryField label="Batch Status">
        <span
          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(batch.status)}`}
        >
          {batch.status}
        </span>
      </SummaryField>
      <SummaryField label="Trigger" value={formatTriggerLabel(batch.trigger)} />
      <SummaryField label="Started" value={formatImportDate(batch.started_at)} />
      <SummaryField label="Finished" value={formatImportDate(batch.finished_at)} />
      <SummaryField label="Duration" value={formatImportDuration(batch.duration_seconds)} />
      <SummaryField
        label="Manufacturers Processed"
        value={`${manufacturers.length}/${batch.manufacturer_total}`}
      />
      <SummaryField label="Imported" value={String(batch.imported)} />
      <SummaryField label="Updated" value={String(batch.updated)} />
      <SummaryField label="Skipped" value={String(batch.skipped)} />
      <SummaryField label="Failed" value={String(batch.failed)} />
      <SummaryField label="Success Rate" value={`${successRate}%`} />
    </div>
  );
}

function SummaryField({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-white/45">{label}</p>
      {children ?? <p className="mt-1 text-sm font-medium text-white">{value}</p>}
    </div>
  );
}
