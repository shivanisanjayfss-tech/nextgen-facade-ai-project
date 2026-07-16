import { ServiceError } from "@/lib/errors";
import { parseMaterialSpecs } from "@/lib/material-specs";
import {
  normalizeGalleryImageUrls,
  normalizeProductImageUrl,
  pickBestProductImageUrl,
} from "@/lib/product-image-url";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import type { MaterialRow } from "@/types/database";
import { DB_TABLES } from "@/types/database";

export interface RepairProductImagesResult {
  scanned: number;
  updated: number;
  skipped: number;
  backfilledFromGallery: number;
  errors: Array<{ id: string; slug: string; message: string }>;
}

/**
 * Normalizes stored image_url values and backfills from gallery images when needed.
 * Never clears an existing image_url.
 */
export async function repairProductImageUrls(
  slugs?: string[],
): Promise<RepairProductImagesResult> {
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

  let query = supabase.from(DB_TABLES.materials).select("*");
  if (slugs?.length) {
    query = query.in("slug", slugs);
  }

  const { data, error } = await query;
  if (error) {
    throw new ServiceError(
      `Failed to load materials: ${error.message}`,
      "DATABASE_ERROR",
      500,
    );
  }

  const result: RepairProductImagesResult = {
    scanned: data?.length ?? 0,
    updated: 0,
    skipped: 0,
    backfilledFromGallery: 0,
    errors: [],
  };

  for (const row of (data ?? []) as MaterialRow[]) {
    try {
      const specs = parseMaterialSpecs(row.specs) as Record<string, unknown>;
      const galleryImages = Array.isArray(specs.galleryImages)
        ? (specs.galleryImages as string[])
        : undefined;
      const normalizedGallery = normalizeGalleryImageUrls(galleryImages);
      const resolvedImage = pickBestProductImageUrl(row.image_url, normalizedGallery);

      const payload: Partial<MaterialRow> = {};
      let changed = false;

      if (resolvedImage && resolvedImage !== row.image_url) {
        payload.image_url = resolvedImage;
        changed = true;

        if (!row.image_url && resolvedImage) {
          result.backfilledFromGallery += 1;
        }
      }

      if (normalizedGallery.length > 0) {
        const currentGallery = normalizeGalleryImageUrls(galleryImages);
        const galleryChanged =
          JSON.stringify(currentGallery) !== JSON.stringify(normalizedGallery);

        if (galleryChanged) {
          payload.specs = {
            ...specs,
            galleryImages: normalizedGallery,
          };
          changed = true;
        }
      }

      if (!changed) {
        result.skipped += 1;
        continue;
      }

      const { error: updateError } = await supabase
        .from(DB_TABLES.materials)
        .update(payload)
        .eq("id", row.id);

      if (updateError) {
        throw new ServiceError(updateError.message, "DATABASE_ERROR", 500);
      }

      result.updated += 1;
    } catch (updateError) {
      result.errors.push({
        id: row.id,
        slug: row.slug,
        message:
          updateError instanceof Error ? updateError.message : "Unknown repair error",
      });
    }
  }

  return result;
}
