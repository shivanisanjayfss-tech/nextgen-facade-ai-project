/** Canonical company name for catalogue grouping. */
export const CANONICAL_MANUFACTURERS = {
  THREE_A_COMPOSITES: "3A Composites",
  GUARDIAN_GLASS: "Guardian Glass",
  AGC_GLASS: "AGC Glass",
} as const;

/** Product brands owned by a manufacturer company. */
export const PRODUCT_BRANDS = {
  ALUCOBOND: "ALUCOBOND",
  ALPOLIC: "ALPOLIC",
} as const;

const MANUFACTURER_ALIASES: Record<string, string> = {
  alucobond: CANONICAL_MANUFACTURERS.THREE_A_COMPOSITES,
  "3a composites": CANONICAL_MANUFACTURERS.THREE_A_COMPOSITES,
  "3a-composites": CANONICAL_MANUFACTURERS.THREE_A_COMPOSITES,
};

const SOURCE_BRAND_HINTS: Array<{ pattern: RegExp; brand: string }> = [
  { pattern: /alucobond\.com/i, brand: PRODUCT_BRANDS.ALUCOBOND },
  { pattern: /alpolic\.com/i, brand: PRODUCT_BRANDS.ALPOLIC },
];

const MANUFACTURER_DEFAULT_BRANDS: Record<string, string> = {
  [CANONICAL_MANUFACTURERS.THREE_A_COMPOSITES.toLowerCase()]:
    PRODUCT_BRANDS.ALUCOBOND,
  "mitsubishi chemical": PRODUCT_BRANDS.ALPOLIC,
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

/** Resolves legacy/import manufacturer labels to a single catalogue company name. */
export function resolveCanonicalManufacturer(
  manufacturer: string,
  sourceUrl?: string | null,
): string {
  const trimmed = manufacturer.trim();
  if (!trimmed) return trimmed;

  const alias = MANUFACTURER_ALIASES[normalizeKey(trimmed)];
  if (alias) return alias;

  if (sourceUrl) {
    for (const { pattern, brand } of SOURCE_BRAND_HINTS) {
      if (pattern.test(sourceUrl)) {
        if (brand === PRODUCT_BRANDS.ALUCOBOND) {
          return CANONICAL_MANUFACTURERS.THREE_A_COMPOSITES;
        }
      }
    }
  }

  return trimmed;
}

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

  const canonical = resolveCanonicalManufacturer(options.manufacturer, options.sourceUrl);
  return MANUFACTURER_DEFAULT_BRANDS[normalizeKey(canonical)] ?? null;
}

/** Returns true when the manufacturer or source URL belongs to Alucobond imports. */
export function isAlucobondCatalogueEntry(
  manufacturer: string,
  sourceUrl?: string | null,
): boolean {
  if (normalizeKey(manufacturer) === "alucobond") return true;
  if (resolveCanonicalManufacturer(manufacturer, sourceUrl) === CANONICAL_MANUFACTURERS.THREE_A_COMPOSITES) {
    return Boolean(sourceUrl && /alucobond\.com/i.test(sourceUrl));
  }
  return /alucobond\.com/i.test(sourceUrl ?? "");
}

/** Stable key for grouping manufacturers in browse views. */
export function manufacturerCatalogueKey(manufacturer: string, sourceUrl?: string | null): string {
  return normalizeKey(resolveCanonicalManufacturer(manufacturer, sourceUrl));
}

/** Manufacturer labels that should match the same catalogue company in DB queries. */
export function getManufacturerCatalogueMatchNames(
  manufacturer: string,
  sourceUrl?: string | null,
): string[] {
  const canonical = resolveCanonicalManufacturer(manufacturer, sourceUrl);
  const names = new Set<string>([canonical]);

  for (const [alias, target] of Object.entries(MANUFACTURER_ALIASES)) {
    if (target === canonical) {
      names.add(alias.replace(/\b\w/g, (char) => char.toUpperCase()));
    }
  }

  if (canonical === CANONICAL_MANUFACTURERS.THREE_A_COMPOSITES) {
    names.add("Alucobond");
  }

  return Array.from(names);
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
