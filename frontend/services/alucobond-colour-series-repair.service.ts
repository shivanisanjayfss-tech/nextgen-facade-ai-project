import {
  ALUCOBOND_BRAND_PARENT_SLUGS,
  applyInheritedSpecs,
  isAlucobondColourSeriesUrl,
  resolveAlucobondParentSlug,
} from "@/lib/alucobond-colour-series";
import { ServiceError } from "@/lib/errors";
import { mapCrawledProductToMaterialRow } from "@/services/material-import.service";
import { getSupabaseServer } from "@/lib/supabase";
import { parseMaterialSpecs } from "@/lib/material-specs";
import type { MaterialRow } from "@/types/database";
import { DB_TABLES } from "@/types/database";
import type { CrawledProduct } from "@/types/import";

export interface RepairAlucobondColourSeriesResult {
  scanned: number;
  updated: number;
  skipped: number;
}

function rowToCrawledProduct(row: MaterialRow): CrawledProduct {
  const specs = parseMaterialSpecs(row.specs);

  return {
    productName: row.name,
    manufacturer: row.manufacturer,
    category: row.category,
    description: row.description,
    sourceUrl: row.source_url ?? "",
    imageUrl: row.image_url ?? undefined,
    datasheetUrl: row.datasheet_url ?? undefined,
    fireRating: typeof specs.fireRating === "string" ? specs.fireRating : undefined,
    thickness: typeof specs.thickness === "string" ? specs.thickness : undefined,
    dimensions: typeof specs.dimensions === "string" ? specs.dimensions : undefined,
    colourSeriesName: typeof specs.colourSeries === "string" ? specs.colourSeries : row.name,
    productFamily: typeof specs.productFamily === "string" ? specs.productFamily : "ALUCOBOND",
    finish: typeof specs.finish === "string" ? specs.finish : undefined,
    surface: typeof specs.surface === "string" ? specs.surface : undefined,
    availableColours: Array.isArray(specs.colours)
      ? specs.colours.filter((entry): entry is string => typeof entry === "string")
      : undefined,
    galleryImages: Array.isArray(specs.galleryImages)
      ? specs.galleryImages.filter((entry): entry is string => typeof entry === "string")
      : undefined,
    inheritSpecsFromSlug: resolveAlucobondParentSlug(row.source_url ?? ""),
    pageType: "colour-series",
  };
}

/** Backfills colour-series materials with inherited brand specifications from Supabase parents. */
export async function repairAlucobondColourSeriesMaterials(): Promise<RepairAlucobondColourSeriesResult> {
  const supabase = getSupabaseServer();
  if (!supabase) {
    throw new ServiceError("Supabase client is unavailable.", "MISSING_SUPABASE", 503);
  }

  const parentSpecs = new Map<string, Record<string, unknown>>();
  const parentDownloads = new Map<string, { datasheetUrl: string | null; brochureUrl?: string }>();

  for (const slug of Object.values(ALUCOBOND_BRAND_PARENT_SLUGS)) {
    const { data, error } = await supabase
      .from(DB_TABLES.materials)
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      throw new ServiceError(error.message, "DATABASE_ERROR", 500);
    }

    if (!data) continue;

    const row = data as MaterialRow;
    const specs = parseMaterialSpecs(row.specs);
    parentSpecs.set(slug, specs);
    parentDownloads.set(slug, {
      datasheetUrl: row.datasheet_url,
      brochureUrl: typeof specs.brochureUrl === "string" ? specs.brochureUrl : undefined,
    });
  }

  const { data: materials, error: listError } = await supabase
    .from(DB_TABLES.materials)
    .select("*")
    .or("manufacturer.ilike.Alucobond,manufacturer.ilike.3A Composites,source_url.ilike.%alucobond.com%");

  if (listError) {
    throw new ServiceError(listError.message, "DATABASE_ERROR", 500);
  }

  const result: RepairAlucobondColourSeriesResult = {
    scanned: 0,
    updated: 0,
    skipped: 0,
  };

  for (const rawRow of materials ?? []) {
    const row = rawRow as MaterialRow;
    if (!isAlucobondColourSeriesUrl(row.source_url)) continue;

    result.scanned += 1;

    const product = rowToCrawledProduct(row);
    const parentSlug = product.inheritSpecsFromSlug ?? ALUCOBOND_BRAND_PARENT_SLUGS.plus;
    const parentSpec = parentSpecs.get(parentSlug);
    if (!parentSpec) {
      result.skipped += 1;
      continue;
    }

    const enriched = applyInheritedSpecs(
      product,
      parentSpec,
      parentDownloads.get(parentSlug),
    );
    const incoming = mapCrawledProductToMaterialRow(enriched);

    const { error: updateError } = await supabase
      .from(DB_TABLES.materials)
      .update({
        specs: incoming.specs,
        datasheet_url: incoming.datasheet_url ?? row.datasheet_url,
      })
      .eq("id", row.id);

    if (updateError) {
      throw new ServiceError(updateError.message, "DATABASE_ERROR", 500);
    }

    result.updated += 1;
  }

  return result;
}
