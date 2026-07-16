import {
  isAlucobondCatalogueEntry,
  isCatalogueDemoDuplicate,
  PRODUCT_BRANDS,
  resolveProductBrand,
} from "@/lib/manufacturer-catalog";
import { ServiceError } from "@/lib/errors";
import { parseMaterialSpecs } from "@/lib/material-specs";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { resolveManufacturerIdentity } from "@/services/manufacturer-identity.service";
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

async function shouldMigrateRow(row: MaterialRow): Promise<boolean> {
  if (isDemoDuplicate(row)) return false;

  const identity = await resolveManufacturerIdentity({
    manufacturerId: row.manufacturer_id ?? undefined,
    rawName: row.manufacturer,
    sourceUrl: row.source_url ?? undefined,
  });

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
    identity.manufacturerId !== row.manufacturer_id ||
    identity.canonicalName !== row.manufacturer.trim() ||
    Boolean(brand && currentBrand !== brand)
  );
}

/**
 * Normalizes manufacturer identity fields and removes mock duplicates that overlap imports.
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

      if (!(await shouldMigrateRow(rawRow))) {
        result.skipped += 1;
        continue;
      }

      const identity = await resolveManufacturerIdentity({
        manufacturerId: rawRow.manufacturer_id ?? undefined,
        rawName: rawRow.manufacturer,
        sourceUrl: rawRow.source_url ?? undefined,
      });

      const specs = parseMaterialSpecs(rawRow.specs) as Record<string, unknown>;
      const brand =
        resolveProductBrand({
          manufacturer: rawRow.manufacturer,
          sourceUrl: rawRow.source_url,
          specs,
        }) ?? PRODUCT_BRANDS.ALUCOBOND;

      const payload: Partial<MaterialRow> = {
        manufacturer_id: identity.manufacturerId,
        manufacturer: identity.canonicalName || rawRow.manufacturer,
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
