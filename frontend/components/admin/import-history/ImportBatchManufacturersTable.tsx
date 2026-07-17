import Link from "next/link";
import { formatCrawlStatus, formatImportDuration } from "@/lib/import-history-display";
import type { ImportHistoryRow } from "@/types/import-history";

interface ImportBatchManufacturersTableProps {
  rows: ImportHistoryRow[];
  emptyMessage?: string;
}

/** Manufacturer outcomes table on the batch details page. */
export function ImportBatchManufacturersTable({
  rows,
  emptyMessage = "No manufacturer runs linked to this batch yet.",
}: ImportBatchManufacturersTableProps) {
  if (rows.length === 0) {
    return <p className="px-6 pb-6 text-sm text-white/50">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1040px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-white/50">
            <th className="px-6 py-3 font-medium">Manufacturer</th>
            <th className="px-6 py-3 font-medium">Crawl Status</th>
            <th className="px-6 py-3 font-medium text-right">Pages Crawled</th>
            <th className="px-6 py-3 font-medium text-right">Imported</th>
            <th className="px-6 py-3 font-medium text-right">Updated</th>
            <th className="px-6 py-3 font-medium text-right">Skipped</th>
            <th className="px-6 py-3 font-medium text-right">Failed</th>
            <th className="px-6 py-3 font-medium text-right">Duration</th>
            <th className="px-6 py-3 font-medium">Error</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-white/5 align-top text-white/70 transition-colors hover:bg-white/[0.02]"
            >
              <td className="px-6 py-4">
                <Link
                  href={`/admin/import-history/${encodeURIComponent(row.id)}`}
                  className="font-medium text-sky-300 hover:text-sky-200 hover:underline"
                >
                  {row.manufacturer}
                </Link>
              </td>
              <td className="px-6 py-4 text-xs uppercase text-white/60">
                {formatCrawlStatus(row.crawl_status)}
              </td>
              <td className="px-6 py-4 text-right tabular-nums">{row.crawled_pages ?? 0}</td>
              <td className="px-6 py-4 text-right tabular-nums">{row.imported}</td>
              <td className="px-6 py-4 text-right tabular-nums">{row.updated}</td>
              <td className="px-6 py-4 text-right tabular-nums">{row.skipped}</td>
              <td className="px-6 py-4 text-right tabular-nums">{row.failed}</td>
              <td className="px-6 py-4 text-right tabular-nums">
                {formatImportDuration(row.duration_seconds)}
              </td>
              <td className="max-w-xs px-6 py-4 text-xs text-red-200">
                {row.error_message ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
