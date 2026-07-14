import {
  isAlucobondSourceUrl,
  isGenericProductName,
  resolveAlucobondProductNameFromUrl,
} from "@/lib/alucobond-product-names";
import { ServiceError } from "@/lib/errors";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import type { MaterialRow } from "@/types/database";
import { DB_TABLES } from "@/types/database";

export interface RepairAlucobondNamesResult {
  scanned: number;
  updated: number;
  skipped: number;
  errors: Array<{ id: string; sourceUrl: string; message: string }>;
}

/**
 * Repairs Alucobond materials that were saved with generic website titles.
 * Matches by source_url and updates name in place — no duplicate rows created.
 */
export async function repairAlucobondProductNames(): Promise<RepairAlucobondNamesResult> {
  if (!isSupabaseConfigured()) {
    throw new ServiceError(
      "Supabase is not configured.",
      "SUPABASE_NOT_CONFIGURED",
      503,
    );
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    throw new ServiceError(
      "Supabase is not configured.",
      "SUPABASE_NOT_CONFIGURED",
      503,
    );
  }

  const { data, error } = await supabase
    .from(DB_TABLES.materials)
    .select("*")
    .or("source_url.ilike.%alucobond.com%by-brand%,manufacturer.ilike.%alucobond%");

  if (error) {
    throw new ServiceError(
      `Failed to load Alucobond materials: ${error.message}`,
      "DATABASE_ERROR",
      500,
    );
  }

  const result: RepairAlucobondNamesResult = {
    scanned: data?.length ?? 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const row of (data ?? []) as MaterialRow[]) {
    const sourceUrl = row.source_url ?? "";
    if (!isAlucobondSourceUrl(sourceUrl)) {
      result.skipped += 1;
      continue;
    }

    const correctName = resolveAlucobondProductNameFromUrl(sourceUrl);
    if (!correctName) {
      result.skipped += 1;
      continue;
    }

    if (row.name.trim() === correctName) {
      result.skipped += 1;
      continue;
    }

    const shouldRepair =
      isGenericProductName(row.name) || row.name.trim() !== correctName;

    if (!shouldRepair) {
      result.skipped += 1;
      continue;
    }

    const { error: updateError } = await supabase
      .from(DB_TABLES.materials)
      .update({ name: correctName })
      .eq("id", row.id);

    if (updateError) {
      result.errors.push({
        id: row.id,
        sourceUrl,
        message: updateError.message,
      });
      continue;
    }

    result.updated += 1;
  }

  return result;
}
