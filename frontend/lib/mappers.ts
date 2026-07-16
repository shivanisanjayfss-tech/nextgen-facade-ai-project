import { normalizeMaterialCategory } from "@/lib/material-categories";
import { resolveProductBrand } from "@/lib/manufacturer-catalog";
import { parseMaterialSpecs } from "@/lib/material-specs";
import { normalizeProductImageUrl, pickBestProductImageUrl } from "@/lib/product-image-url";
import type { MaterialRow, DatasheetRow, KnowledgeArticleRow } from "@/types/database";
import type { Datasheet, KnowledgeArticle, Material, MaterialCategory, MaterialSpecs, MaterialSummary } from "@/types";

function resolveRowImageUrl(
  row: Pick<MaterialRow, "image_url" | "specs">,
): string | null {
  const specs = parseMaterialSpecs(row.specs) as Record<string, unknown>;
  const galleryImages = Array.isArray(specs.galleryImages)
    ? (specs.galleryImages as string[])
    : undefined;

  return pickBestProductImageUrl(row.image_url, galleryImages);
}

function resolveRowBrand(
  row: Pick<MaterialRow, "manufacturer" | "specs" | "source_url">,
): string | null {
  const specs = parseMaterialSpecs(row.specs) as Record<string, unknown>;
  return resolveProductBrand({
    manufacturer: row.manufacturer,
    sourceUrl: row.source_url,
    specs,
  });
}

function resolveRowManufacturer(
  row: Pick<MaterialRow, "manufacturer">,
): string {
  return row.manufacturer.trim();
}

/** Maps a Supabase material row to the domain Material type. */
export function mapMaterialRow(row: MaterialRow): Material {
  const manufacturer = resolveRowManufacturer(row);
  const brand = resolveRowBrand(row);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: normalizeMaterialCategory(row.category),
    manufacturer,
    manufacturerId: row.manufacturer_id ?? null,
    brand,
    description: row.description,
    specs: parseMaterialSpecs(row.specs) as MaterialSpecs,
    imageUrl: resolveRowImageUrl(row),
    datasheetUrl: normalizeProductImageUrl(row.datasheet_url),
    sourceUrl: normalizeProductImageUrl(row.source_url),
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Maps a Supabase material row to a lightweight summary. */
export function mapMaterialSummary(row: MaterialRow): MaterialSummary {
  const material = mapMaterialRow(row);
  return {
    id: material.id,
    name: material.name,
    slug: material.slug,
    category: material.category,
    manufacturer: material.manufacturer,
    manufacturerId: material.manufacturerId,
    brand: material.brand,
    description: material.description,
    imageUrl: material.imageUrl,
    tags: material.tags,
  };
}

/** Maps a Supabase datasheet row to the domain Datasheet type. */
export function mapDatasheetRow(row: DatasheetRow): Datasheet {
  return {
    id: row.id,
    materialId: row.material_id,
    title: row.title,
    manufacturer: row.manufacturer,
    category: normalizeMaterialCategory(row.category),
    fileUrl: row.file_url,
    fileSize: row.file_size ?? undefined,
    version: row.version ?? undefined,
    publishedAt: row.published_at,
    pages: row.pages ?? undefined,
  };
}

/** Maps a Supabase knowledge article row to the domain KnowledgeArticle type. */
export function mapKnowledgeArticleRow(row: KnowledgeArticleRow): KnowledgeArticle {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    category: row.category as KnowledgeArticle["category"],
    author: row.author,
    readTimeMinutes: row.read_time_minutes,
    publishedAt: row.published_at,
    tags: row.tags ?? [],
  };
}
