/** Product brands used for display and import enrichment (not manufacturer identity). */
export const PRODUCT_BRANDS = {
  ALUCOBOND: "ALUCOBOND",
  ALPOLIC: "ALPOLIC",
} as const;

const SOURCE_BRAND_HINTS: Array<{ pattern: RegExp; brand: string }> = [
  { pattern: /alucobond\.com/i, brand: PRODUCT_BRANDS.ALUCOBOND },
  { pattern: /alpolic\.com/i, brand: PRODUCT_BRANDS.ALPOLIC },
];

/** Resolves the product brand for a material row or import payload. */
export function resolveProductBrand(options: {
  manufacturer: string;
  brand?: string | null;
  sourceUrl?: string | null;
  specs?: Record<string, unknown> | null;
}): string | null {
  const explicitBrand =
    options.brand?.trim() ||
    (typeof options.specs?.brand === "string" ? options.specs.brand.trim() : "") ||
    (typeof options.specs?.productFamily === "string"
      ? options.specs.productFamily.trim()
      : "");

  if (explicitBrand) return explicitBrand;

  if (options.sourceUrl) {
    for (const { pattern, brand } of SOURCE_BRAND_HINTS) {
      if (pattern.test(options.sourceUrl)) return brand;
    }
  }

  return null;
}

/** Returns true when the source URL belongs to an Alucobond product page. */
export function isAlucobondCatalogueEntry(
  _manufacturer: string,
  sourceUrl?: string | null,
): boolean {
  return /alucobond\.com/i.test(sourceUrl ?? "");
}

const CATALOGUE_DEMO_DUPLICATE_SLUGS = new Set(["alucobond-plus-a2"]);

/** Mock/seed rows that duplicate imported catalogue products and should be hidden. */
export function isCatalogueDemoDuplicate(material: {
  slug: string;
  sourceUrl?: string | null;
  source_url?: string | null;
}): boolean {
  const sourceUrl = material.sourceUrl ?? material.source_url ?? null;
  return CATALOGUE_DEMO_DUPLICATE_SLUGS.has(material.slug) && !sourceUrl?.trim();
}

/** Slugs excluded from browse/search catalogue views. */
export function getCatalogueDemoDuplicateSlugs(): ReadonlySet<string> {
  return CATALOGUE_DEMO_DUPLICATE_SLUGS;
}

/** Display label for grouped manufacturer cards. */
export function formatManufacturerGroupLabel(
  manufacturer: string,
  brands: string[],
): string {
  if (brands.length === 1) {
    return `${manufacturer} · ${brands[0]}`;
  }

  return manufacturer;
}
