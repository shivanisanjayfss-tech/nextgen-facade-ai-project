import { MATERIAL_CATEGORIES } from "@/lib/material-categories";
import type { MaterialCategory, MaterialSummary } from "@/types";

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

function manufacturerKey(category: string, manufacturer: string): string {
  return `${category}::${manufacturer}`;
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

/** Groups materials into category → manufacturer → products hierarchy. */
export function groupMaterialsByCategoryAndManufacturer(
  items: MaterialSummary[],
): CategoryGroup[] {
  const categoryMap = new Map<string, Map<string, MaterialSummary[]>>();

  for (const item of items) {
    if (!categoryMap.has(item.category)) {
      categoryMap.set(item.category, new Map());
    }

    const manufacturerMap = categoryMap.get(item.category)!;
    if (!manufacturerMap.has(item.manufacturer)) {
      manufacturerMap.set(item.manufacturer, []);
    }

    manufacturerMap.get(item.manufacturer)!.push(item);
  }

  return MATERIAL_CATEGORIES.filter((category) => categoryMap.has(category)).map(
    (category) => {
      const manufacturerMap = categoryMap.get(category)!;
      const manufacturers = Array.from(manufacturerMap.entries())
        .map(([manufacturer, products]) => ({
          manufacturer,
          products: [...products].sort((a, b) => a.name.localeCompare(b.name)),
          count: products.length,
        }))
        .sort((a, b) => a.manufacturer.localeCompare(b.manufacturer));

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
      const manufacturerNormalized = manufacturerGroup.manufacturer.toLowerCase();

      if (manufacturerNormalized.includes(normalized)) {
        expandManufacturers.add(
          manufacturerKey(group.category, manufacturerGroup.manufacturer),
        );
      }

      for (const product of manufacturerGroup.products) {
        const productNormalized = product.name.toLowerCase();

        if (productNormalized === normalized) {
          expandManufacturers.add(
            manufacturerKey(group.category, manufacturerGroup.manufacturer),
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
            manufacturerKey(group.category, manufacturerGroup.manufacturer),
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
