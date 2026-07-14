import type { Material, MaterialSummary } from "@/types";
import { normalizeProductImageUrl } from "@/lib/product-image-url";

/** Full material payload returned by product detail API routes. */
export interface MaterialDetailResponse {
  id: string;
  name: string;
  slug: string;
  category: Material["category"];
  manufacturer: string;
  description: string;
  specs: Material["specs"];
  imageUrl: string | null;
  datasheetUrl: string | null;
  sourceUrl: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/** Summary payload returned by materials list API routes. */
export interface MaterialSummaryResponse {
  id: string;
  name: string;
  slug: string;
  category: Material["category"];
  manufacturer: string;
  description: string;
  imageUrl: string | null;
  tags: string[];
}

function toNullableUrl(value?: string | null): string | null {
  return normalizeProductImageUrl(value);
}

/** Serializes a material for API responses with explicit nulls for missing URLs. */
export function mapMaterialToDetailResponse(material: Material): MaterialDetailResponse {
  return {
    id: material.id,
    name: material.name,
    slug: material.slug,
    category: material.category,
    manufacturer: material.manufacturer,
    description: material.description,
    specs: material.specs,
    imageUrl: toNullableUrl(material.imageUrl),
    datasheetUrl: toNullableUrl(material.datasheetUrl),
    sourceUrl: toNullableUrl(material.sourceUrl),
    tags: material.tags ?? [],
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
  };
}

/** Serializes a material summary for API responses with explicit nulls for missing URLs. */
export function mapMaterialToSummaryResponse(material: MaterialSummary): MaterialSummaryResponse {
  return {
    id: material.id,
    name: material.name,
    slug: material.slug,
    category: material.category,
    manufacturer: material.manufacturer,
    description: material.description,
    imageUrl: toNullableUrl(material.imageUrl),
    tags: material.tags ?? [],
  };
}
