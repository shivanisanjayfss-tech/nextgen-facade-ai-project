import type { MaterialCategory } from "@/types/material";

/** Canonical material categories used across UI, API, and database validation. */
export const MATERIAL_CATEGORIES: MaterialCategory[] = [
  "ACP Sheet",
  "Glass",
  "Stone",
  "HPL",
  "Louvers",
  "Metal",
  "Composite",
  "Other",
];

/** Legacy aliases accepted during import and API filtering. */
const LEGACY_CATEGORY_ALIASES: Record<string, MaterialCategory> = {
  ACP: "ACP Sheet",
};

/**
 * Returns all database category values that match a filter.
 * Includes legacy values (e.g. "ACP") until migration completes.
 */
export function resolveCategoryDbValues(category?: string): string[] | undefined {
  if (!category?.trim()) return undefined;

  const normalized = normalizeMaterialCategory(category);
  const legacyValues = Object.entries(LEGACY_CATEGORY_ALIASES)
    .filter(([, canonical]) => canonical === normalized)
    .map(([legacy]) => legacy);

  return Array.from(new Set([normalized, ...legacyValues]));
}

/**
 * Normalizes a category string to a valid MaterialCategory.
 * Maps legacy "ACP" to "ACP Sheet" so existing imports keep working.
 */
export function normalizeMaterialCategory(value: string): MaterialCategory {
  const trimmed = value.trim();
  const aliased = LEGACY_CATEGORY_ALIASES[trimmed] ?? trimmed;

  const match = MATERIAL_CATEGORIES.find(
    (category) => category.toLowerCase() === aliased.toLowerCase(),
  );

  return match ?? "Other";
}

/** Search terms that resolve to a material category instead of a text query. */
const CATEGORY_SEARCH_SYNONYMS: Partial<Record<MaterialCategory, readonly string[]>> = {
  "ACP Sheet": [
    "acp",
    "acp sheet",
    "aluminium composite panel",
    "aluminium composite panels",
    "aluminum composite panel",
    "aluminum composite panels",
  ],
};

/**
 * When a search query is a category synonym (e.g. "acp" → ACP Sheet),
 * returns the canonical category. Other categories are unaffected.
 */
export function resolveSearchQueryCategory(query: string): MaterialCategory | undefined {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return undefined;

  for (const [category, synonyms] of Object.entries(CATEGORY_SEARCH_SYNONYMS) as Array<
    [MaterialCategory, readonly string[]]
  >) {
    if (synonyms.includes(normalized)) {
      return category;
    }
  }

  return undefined;
}

/** Resolves a category filter for database queries, including legacy aliases. */
export function resolveCategoryFilter(category?: string): string | undefined {
  if (!category?.trim()) return undefined;
  return normalizeMaterialCategory(category);
}
