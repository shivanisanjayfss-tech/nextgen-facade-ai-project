import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { DB_TABLES } from "@/types/database";
import type { ManufacturerRegistryRow } from "@/types/manufacturer-registry";

function isMissingManufacturerIdColumn(message?: string): boolean {
  return Boolean(
    message?.includes("manufacturer_id") && message.includes("does not exist"),
  );
}

function isMissingManufacturersTable(message?: string): boolean {
  return Boolean(
    message?.includes("manufacturers") &&
      (message.includes("Could not find the table") ||
        message.includes("does not exist") ||
        message.includes("PGRST205")),
  );
}

export interface ManufacturerProductCountMap {
  /** Counts keyed by manufacturer_id when available. */
  byId: Map<string, number>;
  /** Counts keyed by lowercased manufacturer name (backward compat). */
  byName: Map<string, number>;
}

/** Loads live product counts from materials, preferring manufacturer_id. */
export async function loadManufacturerProductCounts(): Promise<ManufacturerProductCountMap> {
  const byId = new Map<string, number>();
  const byName = new Map<string, number>();

  if (!isSupabaseConfigured()) {
    return { byId, byName };
  }

  const supabase = getSupabaseServer();
  if (!supabase) return { byId, byName };

  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(DB_TABLES.materials)
      .select("manufacturer, manufacturer_id")
      .range(from, from + pageSize - 1);

    if (error) {
      if (isMissingManufacturerIdColumn(error.message)) {
        return loadManufacturerProductCountsByNameOnly();
      }
      console.error(
        "[manufacturer-product-counts] Failed to load materials:",
        error.message,
      );
      break;
    }

    if (!data?.length) break;

    for (const row of data as Array<{
      manufacturer: string;
      manufacturer_id: string | null;
    }>) {
      const nameKey = row.manufacturer.trim().toLowerCase();
      if (nameKey) {
        byName.set(nameKey, (byName.get(nameKey) ?? 0) + 1);
      }

      if (row.manufacturer_id) {
        byId.set(row.manufacturer_id, (byId.get(row.manufacturer_id) ?? 0) + 1);
      }
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return { byId, byName };
}

async function loadManufacturerProductCountsByNameOnly(): Promise<ManufacturerProductCountMap> {
  const byId = new Map<string, number>();
  const byName = new Map<string, number>();
  const supabase = getSupabaseServer();
  if (!supabase) return { byId, byName };

  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(DB_TABLES.materials)
      .select("manufacturer")
      .range(from, from + pageSize - 1);

    if (error) {
      console.error(
        "[manufacturer-product-counts] Name-only load failed:",
        error.message,
      );
      break;
    }

    if (!data?.length) break;

    for (const row of data as Array<{ manufacturer: string }>) {
      const nameKey = row.manufacturer.trim().toLowerCase();
      if (!nameKey) continue;
      byName.set(nameKey, (byName.get(nameKey) ?? 0) + 1);
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return { byId, byName };
}

/** Resolves the product count for a registry row using id join, then name fallback. */
export function resolveRegistryProductCount(
  row: Pick<ManufacturerRegistryRow, "id" | "name" | "brand" | "aliases">,
  counts: ManufacturerProductCountMap,
): number {
  const byId = counts.byId.get(row.id);
  if (byId !== undefined) return byId;

  const candidates = [
    row.name,
    row.brand ?? "",
    ...(row.aliases ?? []),
  ]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  let total = 0;
  const seen = new Set<string>();
  for (const key of candidates) {
    if (seen.has(key)) continue;
    seen.add(key);
    total += counts.byName.get(key) ?? 0;
  }

  return total;
}

/**
 * Writes live product counts back onto manufacturers.total_products.
 * Safe no-op when the registry table is missing.
 */
export async function syncManufacturerProductCounts(
  rows?: ManufacturerRegistryRow[],
): Promise<{ updated: number }> {
  if (!isSupabaseConfigured()) return { updated: 0 };

  const supabase = getSupabaseServer();
  if (!supabase) return { updated: 0 };

  const counts = await loadManufacturerProductCounts();
  const registry =
    rows ??
    (
      await supabase.from(DB_TABLES.manufacturers).select("id, name, brand, aliases")
    ).data ??
    [];

  if (!Array.isArray(registry) || registry.length === 0) {
    return { updated: 0 };
  }

  let updated = 0;

  for (const row of registry as ManufacturerRegistryRow[]) {
    const totalProducts = resolveRegistryProductCount(row, counts);
    if (row.total_products === totalProducts) continue;

    const { error } = await supabase
      .from(DB_TABLES.manufacturers)
      .update({
        total_products: totalProducts,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (error) {
      if (isMissingManufacturersTable(error.message)) {
        return { updated };
      }
      console.error(
        `[manufacturer-product-counts] Failed to update ${row.name}:`,
        error.message,
      );
      continue;
    }

    updated += 1;
  }

  return { updated };
}

export interface ManufacturerRegistryStats {
  total: number;
  withProducts: number;
  withoutProducts: number;
}

/** Returns registry coverage stats using live material joins. */
export async function getManufacturerRegistryStats(
  rows: ManufacturerRegistryRow[],
): Promise<ManufacturerRegistryStats> {
  const counts = await loadManufacturerProductCounts();
  let withProducts = 0;

  for (const row of rows) {
    if (resolveRegistryProductCount(row, counts) > 0) {
      withProducts += 1;
    }
  }

  return {
    total: rows.length,
    withProducts,
    withoutProducts: Math.max(0, rows.length - withProducts),
  };
}
