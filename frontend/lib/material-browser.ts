import { MATERIAL_CATEGORIES } from "@/lib/material-categories";
import { formatManufacturerGroupLabel } from "@/lib/manufacturer-catalog";
import { manufacturerIdentityKey } from "@/lib/manufacturer-identity";
import type { MaterialCategory, MaterialSummary } from "@/types";
import type { ManufacturerRegistryRow } from "@/types/manufacturer-registry";

/** Frontend-only category synonyms for search (no backend changes). */
const CATEGORY_SEARCH_SYNONYMS: Partial<
  Record<MaterialCategory, readonly string[]>
> = {
  "ACP Sheet": [
    "acp",
    "acp sheet",
    "aluminium composite panel",
    "aluminium composite panels",
    "aluminum composite panel",
    "aluminum composite panels",
  ],
  Glass: ["glass", "glazing"],
  Stone: ["stone", "natural stone"],
  HPL: ["hpl", "high pressure laminate"],
  Louvers: ["louvers", "louvres"],
  Metal: ["metal"],
  Composite: ["composite"],
};

export interface ManufacturerGroup {
  manufacturer: string;
  manufacturerId: string | null;
  brands: string[];
  displayName: string;
  products: MaterialSummary[];
  count: number;
}

export interface CategoryGroup {
  category: MaterialCategory;
  manufacturers: ManufacturerGroup[];
  totalProducts: number;
}

export interface SearchBrowseIntent {
  apiQuery?: string;
  apiCategory?: string;
  expandManufacturers: Set<string>;
  highlightedSlug?: string;
}

export interface GroupMaterialsWithRegistryOptions {
  /**
   * Public Materials page may hide zero-product manufacturers.
   * Admin / full registry views should pass false.
   */
  hideZeroProductManufacturers?: boolean;
}

function manufacturerKey(
  category: string,
  manufacturer: string,
  manufacturerId?: string | null,
): string {
  return `${category}::${manufacturerIdentityKey({
    manufacturerId,
    manufacturer,
  })}`;
}

function summarizeBrands(products: MaterialSummary[]): string[] {
  return Array.from(
    new Set(
      products
        .map((product) => product.brand)
        .filter((brand): brand is string => Boolean(brand)),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

/** Maps a search query to API params without changing backend behaviour. */
export function resolveApiSearchParams(
  query: string,
  activeCategory?: string,
): { q?: string; category?: string } {
  const trimmed = query.trim();

  if (activeCategory) {
    return {
      q: trimmed || undefined,
      category: activeCategory,
    };
  }

  const normalized = trimmed.toLowerCase();
  for (const [category, synonyms] of Object.entries(CATEGORY_SEARCH_SYNONYMS) as Array<
    [MaterialCategory, readonly string[]]
  >) {
    if (synonyms.includes(normalized)) {
      return { category };
    }
  }

  return { q: trimmed || undefined };
}

function isCategoryOnlySearch(query: string, activeCategory?: string): boolean {
  if (activeCategory) return false;
  const normalized = query.trim().toLowerCase();
  if (!normalized) return false;

  return Object.values(CATEGORY_SEARCH_SYNONYMS).some((synonyms) =>
    synonyms.includes(normalized),
  );
}

function buildGroupFromProducts(
  manufacturer: string,
  manufacturerId: string | null,
  products: MaterialSummary[],
  brandsHint: string[] = [],
): ManufacturerGroup {
  const brands = summarizeBrands(products);
  const mergedBrands = Array.from(new Set([...brandsHint, ...brands])).sort((a, b) =>
    a.localeCompare(b),
  );

  return {
    manufacturer,
    manufacturerId,
    brands: mergedBrands,
    displayName: formatManufacturerGroupLabel(manufacturer, mergedBrands),
    products: [...products].sort((a, b) => a.name.localeCompare(b.name)),
    count: products.length,
  };
}

/**
 * Groups materials using the manufacturer registry as the source of truth.
 * Products are attached by manufacturer_id first, then by canonical name.
 * Orphan products (no registry match) remain visible under their text manufacturer.
 */
export function groupMaterialsWithRegistry(
  items: MaterialSummary[],
  registry: ManufacturerRegistryRow[],
  options: GroupMaterialsWithRegistryOptions = {},
): CategoryGroup[] {
  const hideZero = options.hideZeroProductManufacturers ?? true;
  const productsByRegistryId = new Map<string, MaterialSummary[]>();
  const productsByName = new Map<string, MaterialSummary[]>();
  const assignedProductIds = new Set<string>();

  const registryById = new Map(registry.map((row) => [row.id, row]));
  const registryByName = new Map<string, ManufacturerRegistryRow>();

  for (const row of registry) {
    registryByName.set(row.name.trim().toLowerCase(), row);
    if (row.brand) {
      registryByName.set(row.brand.trim().toLowerCase(), row);
    }
    for (const alias of row.aliases ?? []) {
      registryByName.set(alias.trim().toLowerCase(), row);
    }
  }

  for (const item of items) {
    if (item.manufacturerId && registryById.has(item.manufacturerId)) {
      const bucket = productsByRegistryId.get(item.manufacturerId) ?? [];
      bucket.push(item);
      productsByRegistryId.set(item.manufacturerId, bucket);
      assignedProductIds.add(item.id);
      continue;
    }

    const byName = registryByName.get(item.manufacturer.trim().toLowerCase());
    if (byName) {
      const bucket = productsByRegistryId.get(byName.id) ?? [];
      bucket.push({ ...item, manufacturerId: byName.id, manufacturer: byName.name });
      productsByRegistryId.set(byName.id, bucket);
      assignedProductIds.add(item.id);
      continue;
    }

    const nameKey = item.manufacturer.trim().toLowerCase();
    const orphanBucket = productsByName.get(nameKey) ?? [];
    orphanBucket.push(item);
    productsByName.set(nameKey, orphanBucket);
  }

  const categoryMap = new Map<string, ManufacturerGroup[]>();

  for (const row of registry) {
    const products = productsByRegistryId.get(row.id) ?? [];
    if (hideZero && products.length === 0) continue;

    const category = row.category as MaterialCategory;
    if (!MATERIAL_CATEGORIES.includes(category) && category !== "Other") {
      // Keep non-standard categories visible rather than dropping them.
    }

    const group = buildGroupFromProducts(
      row.name,
      row.id,
      products,
      row.brand ? [row.brand] : [],
    );

    const list = categoryMap.get(row.category) ?? [];
    list.push(group);
    categoryMap.set(row.category, list);
  }

  // Backward compatibility: products whose manufacturer text is not in the registry.
  for (const [, products] of productsByName) {
    const unassigned = products.filter((product) => !assignedProductIds.has(product.id));
    if (unassigned.length === 0) continue;

    const manufacturer = unassigned[0]?.manufacturer ?? "Unknown";
    const manufacturerId = unassigned[0]?.manufacturerId ?? null;
    const category = unassigned[0]?.category ?? "Other";
    const group = buildGroupFromProducts(manufacturer, manufacturerId, unassigned);
    const list = categoryMap.get(category) ?? [];
    list.push(group);
    categoryMap.set(category, list);
  }

  const orderedCategories = [
    ...MATERIAL_CATEGORIES,
    ...Array.from(categoryMap.keys()).filter(
      (category) => !MATERIAL_CATEGORIES.includes(category as MaterialCategory),
    ),
  ];

  return orderedCategories
    .filter((category) => categoryMap.has(category))
    .map((category) => {
      const manufacturers = (categoryMap.get(category) ?? []).sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      );

      return {
        category: category as MaterialCategory,
        manufacturers,
        totalProducts: manufacturers.reduce((sum, group) => sum + group.count, 0),
      };
    });
}

/**
 * Legacy grouping from materials only — kept for fallback when registry is empty.
 * Prefer groupMaterialsWithRegistry whenever the manufacturers table is available.
 */
export function groupMaterialsByCategoryAndManufacturer(
  items: MaterialSummary[],
): CategoryGroup[] {
  const categoryMap = new Map<string, Map<string, MaterialSummary[]>>();

  for (const item of items) {
    const groupKey = manufacturerIdentityKey({
      manufacturerId: item.manufacturerId,
      manufacturer: item.manufacturer,
    });

    if (!categoryMap.has(item.category)) {
      categoryMap.set(item.category, new Map());
    }

    const manufacturerMap = categoryMap.get(item.category)!;

    if (!manufacturerMap.has(groupKey)) {
      manufacturerMap.set(groupKey, []);
    }

    manufacturerMap.get(groupKey)!.push(item);
  }

  return MATERIAL_CATEGORIES.filter((category) => categoryMap.has(category)).map(
    (category) => {
      const manufacturerMap = categoryMap.get(category)!;
      const manufacturers = Array.from(manufacturerMap.entries())
        .map(([, products]) => {
          const manufacturer = products[0]?.manufacturer ?? "Unknown";
          const manufacturerId = products[0]?.manufacturerId ?? null;
          const brands = summarizeBrands(products);

          return buildGroupFromProducts(manufacturer, manufacturerId, products, brands);
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

      return {
        category,
        manufacturers,
        totalProducts: manufacturers.reduce((sum, group) => sum + group.count, 0),
      };
    },
  );
}

/** Derives auto-expand and highlight behaviour from search query and results. */
export function resolveSearchBrowseIntent(
  query: string,
  groups: CategoryGroup[],
  activeCategory?: string,
): SearchBrowseIntent {
  const trimmed = query.trim();
  const normalized = trimmed.toLowerCase();
  const expandManufacturers = new Set<string>();

  const { q, category } = resolveApiSearchParams(query, activeCategory);

  if (!trimmed || isCategoryOnlySearch(query, activeCategory)) {
    return {
      apiQuery: q,
      apiCategory: category ?? activeCategory,
      expandManufacturers,
    };
  }

  let highlightedSlug: string | undefined;
  let bestProductScore = 0;

  for (const group of groups) {
    for (const manufacturerGroup of group.manufacturers) {
      const manufacturerNormalized = manufacturerGroup.displayName.toLowerCase();
      const canonicalNormalized = manufacturerGroup.manufacturer.toLowerCase();

      if (
        manufacturerNormalized.includes(normalized) ||
        canonicalNormalized.includes(normalized) ||
        manufacturerGroup.brands.some((brand) => brand.toLowerCase().includes(normalized))
      ) {
        expandManufacturers.add(
          manufacturerKey(
            group.category,
            manufacturerGroup.manufacturer,
            manufacturerGroup.manufacturerId,
          ),
        );
      }

      for (const product of manufacturerGroup.products) {
        const productNormalized = product.name.toLowerCase();

        if (productNormalized === normalized) {
          expandManufacturers.add(
            manufacturerKey(
              group.category,
              manufacturerGroup.manufacturer,
              manufacturerGroup.manufacturerId,
            ),
          );
          highlightedSlug = product.slug;
          bestProductScore = 100;
          continue;
        }

        if (
          productNormalized.includes(normalized) &&
          normalized.length >= 3 &&
          normalized.length > bestProductScore
        ) {
          expandManufacturers.add(
            manufacturerKey(
              group.category,
              manufacturerGroup.manufacturer,
              manufacturerGroup.manufacturerId,
            ),
          );
          highlightedSlug = product.slug;
          bestProductScore = normalized.length;
        }
      }
    }
  }

  return {
    apiQuery: q,
    apiCategory: category ?? activeCategory,
    expandManufacturers,
    highlightedSlug,
  };
}

export { manufacturerKey };
