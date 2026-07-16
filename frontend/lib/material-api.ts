import {
  getBrochureUrl,
  getGalleryImageUrls,
  getInstallationGuideUrl,
  getManufacturerCompanyWebsite,
} from "@/lib/material-detail";
import type { Material, MaterialSummary } from "@/types";
import { normalizeProductImageUrl } from "@/lib/product-image-url";

/** Related product summary embedded in product detail API responses. */
export interface MaterialRelatedProductResponse {
  id: string;
  name: string;
  slug: string;
  category: Material["category"];
  imageUrl: string | null;
}

/** Full material payload returned by product detail API routes. */
export interface MaterialDetailResponse {
  id: string;
  name: string;
  slug: string;
  category: Material["category"];
  manufacturer: string;
  brand: string | null;
  description: string;
  specs: Material["specs"];
  imageUrl: string | null;
  gallery: string[];
  datasheetUrl: string | null;
  brochureUrl: string | null;
  installationGuideUrl: string | null;
  manufacturerWebsite: string | null;
  tags: string[];
  relatedProducts: MaterialRelatedProductResponse[];
  manufacturerProductCount: number;
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
  brand: string | null;
  description: string;
  imageUrl: string | null;
  tags: string[];
}

function toNullableUrl(value?: string | null): string | null {
  return normalizeProductImageUrl(value);
}

function mapRelatedProduct(product: MaterialSummary): MaterialRelatedProductResponse {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    category: product.category,
    imageUrl: normalizeProductImageUrl(product.imageUrl),
  };
}

/** Serializes a material for API responses with explicit nulls for missing URLs. */
export function mapMaterialToDetailResponse(
  material: Material,
  options?: {
    relatedProducts?: MaterialSummary[];
    manufacturerProductCount?: number;
  },
): MaterialDetailResponse {
  return {
    id: material.id,
    name: material.name,
    slug: material.slug,
    category: material.category,
    manufacturer: material.manufacturer,
    brand: material.brand,
    description: material.description,
    specs: material.specs,
    imageUrl: toNullableUrl(material.imageUrl),
    gallery: getGalleryImageUrls(material),
    datasheetUrl: toNullableUrl(material.datasheetUrl),
    brochureUrl: getBrochureUrl(material),
    installationGuideUrl: getInstallationGuideUrl(material),
    manufacturerWebsite: getManufacturerCompanyWebsite(material),
    tags: material.tags ?? [],
    relatedProducts: (options?.relatedProducts ?? []).map(mapRelatedProduct),
    manufacturerProductCount: options?.manufacturerProductCount ?? 0,
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
    brand: material.brand,
    description: material.description,
    imageUrl: normalizeProductImageUrl(material.imageUrl),
    tags: material.tags ?? [],
  };
}
