import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import type { MaterialRow } from "@/types/database";
import { DB_TABLES } from "@/types/database";

function normalizeSourceUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

export interface ManufacturerLifecycleResult {
  reactivated: number;
  deactivated: number;
}

/**
 * Marks products not seen in the latest crawl as inactive and reactivates seen ones.
 * Only affects rows linked to the given manufacturer_id.
 */
export async function syncManufacturerProductLifecycle(
  manufacturerId: string,
  seenSourceUrls: string[],
): Promise<ManufacturerLifecycleResult> {
  if (!isSupabaseConfigured() || !manufacturerId.trim()) {
    return { reactivated: 0, deactivated: 0 };
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return { reactivated: 0, deactivated: 0 };
  }

  const seen = new Set(
    seenSourceUrls
      .map((url) => url.trim())
      .filter(Boolean)
      .map(normalizeSourceUrl),
  );

  const { data, error } = await supabase
    .from(DB_TABLES.materials)
    .select("id, source_url, is_active")
    .eq("manufacturer_id", manufacturerId)
    .not("source_url", "is", null);

  if (error) {
    console.error(
      `[material-lifecycle] Failed to load materials for ${manufacturerId}:`,
      error.message,
    );
    return { reactivated: 0, deactivated: 0 };
  }

  let reactivated = 0;
  let deactivated = 0;

  for (const row of data ?? []) {
    const record = row as Pick<MaterialRow, "id" | "source_url" | "is_active">;
    const sourceUrl = record.source_url?.trim();
    if (!sourceUrl) continue;

    const isSeen = seen.has(normalizeSourceUrl(sourceUrl));

    if (isSeen && record.is_active === false) {
      const { error: updateError } = await supabase
        .from(DB_TABLES.materials)
        .update({ is_active: true })
        .eq("id", record.id);

      if (!updateError) reactivated += 1;
      continue;
    }

    if (!isSeen && record.is_active !== false) {
      const { error: updateError } = await supabase
        .from(DB_TABLES.materials)
        .update({ is_active: false })
        .eq("id", record.id);

      if (!updateError) deactivated += 1;
    }
  }

  if (deactivated > 0 || reactivated > 0) {
    console.info(
      `[material-lifecycle] ${manufacturerId}: reactivated=${reactivated}, deactivated=${deactivated}`,
    );
  }

  return { reactivated, deactivated };
}
