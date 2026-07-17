/** Returns true for in-process fallback ids that were never written to Supabase. */
export function isMemoryImportHistoryId(id: string): boolean {
  return id.startsWith("memory-");
}
