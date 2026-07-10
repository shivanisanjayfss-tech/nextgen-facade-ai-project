import type { MaterialRow, DatasheetRow, KnowledgeArticleRow } from "@/types/database";
import type { Datasheet, KnowledgeArticle, Material, MaterialCategory, MaterialSpecs, MaterialSummary } from "@/types";

/** Maps a Supabase material row to the domain Material type. */
export function mapMaterialRow(row: MaterialRow): Material {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category as MaterialCategory,
    manufacturer: row.manufacturer,
    description: row.description,
    specs: row.specs as MaterialSpecs,
    imageUrl: row.image_url ?? undefined,
    datasheetUrl: row.datasheet_url ?? undefined,
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
    category: row.category as MaterialCategory,
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
