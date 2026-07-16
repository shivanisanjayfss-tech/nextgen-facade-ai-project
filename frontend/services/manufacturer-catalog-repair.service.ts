import {
  CANONICAL_MANUFACTURERS,
  isAlucobondCatalogueEntry,
  isCatalogueDemoDuplicate,
  PRODUCT_BRANDS,
  resolveCanonicalManufacturer,
  resolveProductBrand,
} from "@/lib/manufacturer-catalog";
import { ServiceError } from "@/lib/errors";
import { parseMaterialSpecs } from "@/lib/material-specs";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import type { MaterialRow } from "@/types/database";
import { DB_TABLES } from "@/types/database";

export interface RepairManufacturerCatalogResult {
  scanned: number;
  migrated: number;
  deletedDemoDuplicates: number;
  skipped: number;
  errors: Array<{ id: string; slug: string; message: string }>;
}

function isDemoDuplicate(row: MaterialRow): boolean {
  return isCatalogueDemoDuplicate(row);
}

function shouldMigrateRow(row: MaterialRow): boolean {
  if (isDemoDuplicate(row)) return false;

  const canonical = resolveCanonicalManufacturer(row.manufacturer, row.source_url);
  const brand = resolveProductBrand({
    manufacturer: row.manufacturer,
    sourceUrl: row.source_url,
    specs: parseMaterialSpecs(row.specs) as Record<string, unknown>,
  });

  const specs = parseMaterialSpecs(row.specs) as Record<string, unknown>;
  const currentBrand =
    typeof specs.brand === "string" ? specs.brand.trim() : "";

  return (
    isAlucobondCatalogueEntry(row.manufacturer, row.source_url) ||
    canonical !== row.manufacturer.trim() ||
    Boolean(brand && currentBrand !== brand)
  );
}

/**
 * Normalizes manufacturer/brand fields and removes mock duplicates that overlap imports.
 */
export async function repairManufacturerCatalog(): Promise<RepairManufacturerCatalogResult> {
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
    .or(
      [
        "manufacturer.ilike.Alucobond",
        "manufacturer.ilike.3A Composites",
        "source_url.ilike.%alucobond.com%",
      ].join(","),
    );

  if (error) {
    throw new ServiceError(
      `Failed to load materials: ${error.message}`,
      "DATABASE_ERROR",
      500,
    );
  }

  const result: RepairManufacturerCatalogResult = {
    scanned: data?.length ?? 0,
    migrated: 0,
    deletedDemoDuplicates: 0,
    skipped: 0,
    errors: [],
  };

  for (const rawRow of (data ?? []) as MaterialRow[]) {
    try {
      if (isDemoDuplicate(rawRow)) {
        const { error: deleteError } = await supabase
          .from(DB_TABLES.materials)
          .delete()
          .eq("id", rawRow.id);

        if (deleteError) {
          throw new ServiceError(deleteError.message, "DATABASE_ERROR", 500);
        }

        result.deletedDemoDuplicates += 1;
        continue;
      }

      if (!shouldMigrateRow(rawRow)) {
        result.skipped += 1;
        continue;
      }

      const specs = parseMaterialSpecs(rawRow.specs) as Record<string, unknown>;
      const brand =
        resolveProductBrand({
          manufacturer: rawRow.manufacturer,
          sourceUrl: rawRow.source_url,
          specs,
        }) ?? PRODUCT_BRANDS.ALUCOBOND;

      const payload: Partial<MaterialRow> = {
        manufacturer: CANONICAL_MANUFACTURERS.THREE_A_COMPOSITES,
        specs: {
          ...specs,
          brand,
        },
      };

      const { error: updateError } = await supabase
        .from(DB_TABLES.materials)
        .update(payload)
        .eq("id", rawRow.id);

      if (updateError) {
        throw new ServiceError(updateError.message, "DATABASE_ERROR", 500);
      }

      result.migrated += 1;
    } catch (updateError) {
      result.errors.push({
        id: rawRow.id,
        slug: rawRow.slug,
        message:
          updateError instanceof Error ? updateError.message : "Unknown repair error",
      });
    }
  }

  return result;
}
