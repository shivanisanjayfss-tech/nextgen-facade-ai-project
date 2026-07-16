import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingMaterialsIsActiveColumn } from "@/lib/supabase-errors";
import type { MaterialRow } from "@/types/database";
import { DB_TABLES } from "@/types/database";

let isActiveColumnAvailable: boolean | null = null;

/**
 * Probes whether migration 006 (`materials.is_active`) has been applied.
 * Result is cached for the process lifetime.
 */
export async function hasMaterialsIsActiveColumn(
  supabase: SupabaseClient,
): Promise<boolean> {
  if (isActiveColumnAvailable !== null) {
    return isActiveColumnAvailable;
  }

  const { error } = await supabase
    .from(DB_TABLES.materials)
    .select("is_active")
    .limit(1);

  if (!error) {
    isActiveColumnAvailable = true;
    return true;
  }

  if (isMissingMaterialsIsActiveColumn(error)) {
    isActiveColumnAvailable = false;
    return false;
  }

  // Unknown error during probe — assume column unavailable and let callers proceed.
  console.warn(
    "[materials-schema] is_active probe failed:",
    error.message || error.code || error,
  );
  isActiveColumnAvailable = false;
  return false;
}

/** Treats missing column as active so reads work before migration 006 is applied. */
export function isActiveMaterialRow(
  row: Pick<MaterialRow, "is_active">,
): boolean {
  return row.is_active !== false;
}

export function filterActiveMaterialRows<T extends Pick<MaterialRow, "is_active">>(
  rows: T[],
): T[] {
  return rows.filter(isActiveMaterialRow);
}
