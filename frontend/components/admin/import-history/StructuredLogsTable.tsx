import Link from "next/link";
import { formatImportDate } from "@/lib/import-history-display";
import {
  formatPersistedStageLabel,
  getRecordedStageSet,
  PERSISTED_IMPORT_RUN_STAGE_ORDER,
} from "@/lib/import-run-stages";
import type { ImportRunEventRow } from "@/types/import-diagnostics";

interface StructuredLogsTableProps {
  events: ImportRunEventRow[];
  showManufacturer?: boolean;
  showStageCoverage?: boolean;
  emptyMessage?: string;
}

/** Displays persisted import_run_events in chronological order. */
export function StructuredLogsTable({
  events,
  showManufacturer = false,
  showStageCoverage = true,
  emptyMessage = "No structured pipeline events recorded.",
}: StructuredLogsTableProps) {
  if (events.length === 0) {
    return <p className="text-sm text-white/50">{emptyMessage}</p>;
  }

  const recordedStages = getRecordedStageSet(events.map((event) => event.stage));

  return (
    <div className="space-y-4">
      {showStageCoverage && (
        <div className="flex flex-wrap gap-2">
          {PERSISTED_IMPORT_RUN_STAGE_ORDER.map((stage) => {
            const recorded = recordedStages.has(stage);
            return (
              <span
                key={stage}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  recorded
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                    : "border-white/10 bg-white/[0.02] text-white/35"
                }`}
                title={stage}
              >
                {formatPersistedStageLabel(stage)}
              </span>
            );
          })}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-white/50">
              <th className="py-2 pr-4 font-medium">Time</th>
              <th className="py-2 pr-4 font-medium">Stage</th>
              {showManufacturer && (
                <th className="py-2 pr-4 font-medium">Manufacturer</th>
              )}
              <th className="py-2 pr-4 font-medium">Detail</th>
              <th className="py-2 font-medium">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-b border-white/5 align-top">
                <td className="py-2 pr-4 text-white/60">
                  {formatImportDate(event.created_at)}
                </td>
                <td className="py-2 pr-4">
                  <span className="font-mono text-xs text-sky-200">{event.stage}</span>
                  <p className="mt-0.5 text-xs text-white/40">
                    {formatPersistedStageLabel(event.stage)}
                  </p>
                </td>
                {showManufacturer && (
                  <td className="py-2 pr-4 text-white/70">
                    {event.manufacturer ? (
                      event.import_history_id ? (
                        <Link
                          href={`/admin/import-history/${encodeURIComponent(event.import_history_id)}`}
                          className="text-sky-300 hover:underline"
                        >
                          {event.manufacturer}
                        </Link>
                      ) : (
                        event.manufacturer
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                <td className="py-2 pr-4 text-white/70">{event.detail ?? "—"}</td>
                <td className="py-2">
                  {Object.keys(event.metadata ?? {}).length > 0 ? (
                    <pre className="max-w-md overflow-x-auto rounded bg-black/30 p-2 text-xs text-white/50">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
