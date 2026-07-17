import type { ImportHistoryStatus } from "@/types/import-history";

export const IMPORT_STATUS_STYLES: Record<string, string> = {
  succeeded: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
  failed: "text-red-300 bg-red-400/10 border-red-400/20",
  partial: "text-amber-300 bg-amber-400/10 border-amber-400/20",
  running: "text-sky-300 bg-sky-400/10 border-sky-400/20",
};

export function formatImportDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function formatImportDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

export function formatTriggerLabel(trigger: string | null | undefined): string {
  if (!trigger) return "—";
  if (trigger === "manual") return "Manual";
  if (trigger === "cron") return "Scheduled";
  if (trigger === "registry") return "Registry";
  return trigger;
}

export function formatCrawlStatus(status: string | null | undefined): string {
  if (!status) return "—";
  return status.replace(/_/g, " ");
}

export function formatBatchId(batchId: string | null | undefined): string {
  if (!batchId) return "—";
  return batchId.slice(0, 8);
}

export function statusBadgeClass(status: ImportHistoryStatus | string): string {
  return IMPORT_STATUS_STYLES[status] ?? IMPORT_STATUS_STYLES.partial;
}
