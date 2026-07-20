"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  formatBatchId,
  formatImportDate,
  formatImportDuration,
  formatTriggerLabel,
  statusBadgeClass,
} from "@/lib/import-history-display";
import type { ImportBatchSummary } from "@/types/import-analytics";

interface ImportBatchRunsTableProps {
  batches: ImportBatchSummary[];
  emptyMessage?: string;
}

/** Scheduler batch runs table for the Batch Runs view. */
export function ImportBatchRunsTable({
  batches,
  emptyMessage = "No batch runs recorded yet.",
}: ImportBatchRunsTableProps) {
  const router = useRouter();
  const rows = Array.isArray(batches) ? batches : [];

  if (rows.length === 0) {
    return <p className="px-6 pb-6 text-sm text-white/50">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-white/50">
            <th className="px-6 py-3 font-medium">Batch</th>
            <th className="px-6 py-3 font-medium">Started</th>
            <th className="px-6 py-3 font-medium">Status</th>
            <th className="px-6 py-3 font-medium">Trigger</th>
            <th className="px-6 py-3 font-medium text-right">Manufacturers</th>
            <th className="px-6 py-3 font-medium text-right">Imported</th>
            <th className="px-6 py-3 font-medium text-right">Updated</th>
            <th className="px-6 py-3 font-medium text-right">Skipped</th>
            <th className="px-6 py-3 font-medium text-right">Failed</th>
            <th className="px-6 py-3 font-medium text-right">Duration</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((batch) => {
            const rowKey = batch.id || `${batch.started_at}-${batch.trigger}`;
            const href = `/admin/import-history/batches/${encodeURIComponent(batch.id)}`;

            return (
              <tr
                key={rowKey}
                role="link"
                tabIndex={0}
                className="cursor-pointer border-b border-white/5 text-white/70 transition-colors hover:bg-white/[0.04]"
                onClick={(event) => {
                  // Inner <Link> handles its own navigation; don't double-push.
                  if ((event.target as HTMLElement).closest("a")) return;
                  router.push(href);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(href);
                  }
                }}
              >
                <td className="px-6 py-4">
                  <Link
                    href={href}
                    className="font-mono text-xs text-sky-300 hover:text-sky-200 hover:underline"
                    title={batch.id}
                  >
                    {formatBatchId(batch.id)}
                  </Link>
                </td>
                <td className="px-6 py-4">{formatImportDate(batch.started_at)}</td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(batch.status)}`}
                  >
                    {batch.status}
                  </span>
                </td>
                <td className="px-6 py-4">{formatTriggerLabel(batch.trigger)}</td>
                <td className="px-6 py-4 text-right tabular-nums">
                  {batch.manufacturerRunCount}/{batch.manufacturer_total}
                </td>
                <td className="px-6 py-4 text-right tabular-nums">{batch.imported}</td>
                <td className="px-6 py-4 text-right tabular-nums">{batch.updated}</td>
                <td className="px-6 py-4 text-right tabular-nums">{batch.skipped}</td>
                <td className="px-6 py-4 text-right tabular-nums">{batch.failed}</td>
                <td className="px-6 py-4 text-right tabular-nums">
                  {formatImportDuration(batch.duration_seconds)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
