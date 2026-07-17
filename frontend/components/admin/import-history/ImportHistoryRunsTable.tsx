"use client";

import Link from "next/link";
import {
  formatBatchId,
  formatCrawlStatus,
  formatImportDate,
  formatImportDuration,
  formatTriggerLabel,
  statusBadgeClass,
} from "@/lib/import-history-display";
import type { ImportHistoryRow } from "@/types/import-history";

interface ImportHistoryRunsTableProps {
  rows: ImportHistoryRow[];
  emptyMessage?: string;
}

/** Manufacturer-level import history table with diagnostics columns. */
export function ImportHistoryRunsTable({
  rows,
  emptyMessage = "No import runs match the current filters.",
}: ImportHistoryRunsTableProps) {
  if (rows.length === 0) {
    return <p className="px-6 pb-6 text-sm text-white/50">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1280px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-white/50">
            <th className="px-6 py-3 font-medium">Manufacturer</th>
            <th className="px-6 py-3 font-medium">Started</th>
            <th className="px-6 py-3 font-medium">Status</th>
            <th className="px-6 py-3 font-medium">Trigger</th>
            <th className="px-6 py-3 font-medium">Crawl Status</th>
            <th className="px-6 py-3 font-medium text-right">Pages</th>
            <th className="px-6 py-3 font-medium">Batch</th>
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
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-white/5 text-white/70 transition-colors hover:bg-white/[0.02]"
            >
              <td className="px-6 py-4 font-medium text-white">{row.manufacturer}</td>
              <td className="px-6 py-4">{formatImportDate(row.started_at)}</td>
              <td className="px-6 py-4">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(row.status)}`}
                >
                  {row.status}
                </span>
              </td>
              <td className="px-6 py-4">{formatTriggerLabel(row.trigger)}</td>
              <td className="px-6 py-4 text-xs uppercase text-white/60">
                {formatCrawlStatus(row.crawl_status)}
              </td>
              <td className="px-6 py-4 text-right tabular-nums">{row.crawled_pages ?? 0}</td>
              <td className="px-6 py-4">
                {row.scheduler_run_id ? (
                  <Link
                    href={`/admin/import-history/batches/${row.scheduler_run_id}`}
                    className="font-mono text-xs text-sky-300 hover:text-sky-200 hover:underline"
                    title={row.scheduler_run_id}
                  >
                    {formatBatchId(row.scheduler_run_id)}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-6 py-4 text-right tabular-nums">
                {row.product_decisions?.length ?? row.extracted_products ?? 0}
              </td>
              <td className="px-6 py-4 text-right tabular-nums">{row.imported}</td>
              <td className="px-6 py-4 text-right tabular-nums">{row.updated}</td>
              <td className="px-6 py-4 text-right tabular-nums">{row.skipped}</td>
              <td className="px-6 py-4 text-right tabular-nums">{row.failed}</td>
              <td className="px-6 py-4 text-right tabular-nums">
                {formatImportDuration(row.duration_seconds)}
              </td>
              <td className="px-6 py-4 text-right">
                <Link
                  href={`/admin/import-history/${encodeURIComponent(row.id)}`}
                  className="text-sm font-medium text-sky-300 hover:text-sky-200 hover:underline"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
