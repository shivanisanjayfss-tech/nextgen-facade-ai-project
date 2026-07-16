import type { ImportHistoryRow } from "@/types/import-history";

const HISTORY_KEY = "__nextgenImportHistoryMemory__";

export function getMemoryImportHistory(): ImportHistoryRow[] {
  const root = globalThis as typeof globalThis & {
    [HISTORY_KEY]?: ImportHistoryRow[];
  };

  if (!root[HISTORY_KEY]) {
    root[HISTORY_KEY] = [];
  }

  return root[HISTORY_KEY];
}

export function prependMemoryImportHistory(row: ImportHistoryRow): void {
  const history = getMemoryImportHistory();
  history.unshift(row);
  if (history.length > 200) {
    history.length = 200;
  }
}

export function updateMemoryImportHistory(
  id: string,
  patch: Partial<ImportHistoryRow>,
): void {
  const history = getMemoryImportHistory();
  const index = history.findIndex((row) => row.id === id);
  if (index === -1) return;
  history[index] = { ...history[index], ...patch };
}

export function createMemoryImportHistoryId(): string {
  return `memory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
