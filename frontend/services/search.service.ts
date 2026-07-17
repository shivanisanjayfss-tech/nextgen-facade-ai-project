import { isCatalogueDemoDuplicate, resolveProductBrand } from "@/lib/manufacturer-catalog";
import { mapMaterialSummary } from "@/lib/mappers";
import {
  filterActiveMaterialRows,
  hasMaterialsIsActiveColumn,
} from "@/lib/materials-schema";
import { raiseSupabaseError } from "@/lib/supabase-errors";
import {
  resolveCategoryDbValues,
  resolveCategoryFilter,
  resolveSearchQueryCategory,
} from "@/lib/material-categories";
import {
  clampRangeEnd,
  isRangeBeyondTotal,
  isRangeNotSatisfiableError,
  normalizePagination,
} from "@/lib/pagination";
import { MOCK_MATERIALS } from "@/lib/mock-data";
import { getSupabaseServer } from "@/lib/supabase";
import type { MaterialRow } from "@/types/database";
import { DB_TABLES } from "@/types/database";
import type { MaterialCategory } from "@/types/material";
import { searchDatasheetIntelligence } from "@/services/datasheet-intelligence.service";
import type { MaterialSummary, SearchParams, SearchResult } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Escapes special characters for PostgREST ilike patterns. */
function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

function materialMatchesTextQuery(material: MaterialSummary, query: string): boolean {
  const needle = query.toLowerCase();

  return (
    material.name.toLowerCase().includes(needle) ||
    material.manufacturer.toLowerCase().includes(needle) ||
    (material.brand?.toLowerCase().includes(needle) ?? false) ||
    material.category.toLowerCase().includes(needle) ||
    material.description.toLowerCase().includes(needle) ||
    material.slug.toLowerCase().includes(needle) ||
    material.tags.some((tag) => tag.toLowerCase().includes(needle))
  );
}

function materialMatchesCategory(
  material: MaterialSummary,
  category: MaterialCategory,
): boolean {
  const dbCategories = resolveCategoryDbValues(category) ?? [category];
  return dbCategories.some(
    (value) => material.category.toLowerCase() === value.toLowerCase(),
  );
}

function filterMaterials(
  materials: MaterialSummary[],
  params: SearchParams,
): MaterialSummary[] {
  let results = [...materials];
  const query = params.q?.trim() ?? "";
  const categoryFromQuery = query ? resolveSearchQueryCategory(query) : undefined;
  const explicitCategory = params.category
    ? resolveCategoryFilter(params.category)
    : undefined;

  if (explicitCategory) {
    results = results.filter((m) =>
      materialMatchesCategory(m, explicitCategory as MaterialCategory),
    );
  } else if (categoryFromQuery) {
    results = results.filter((m) => materialMatchesCategory(m, categoryFromQuery));
  } else if (query) {
    results = results.filter((m) => materialMatchesTextQuery(m, query));
  }

  if (params.manufacturerId) {
    results = results.filter((m) => m.manufacturerId === params.manufacturerId);
  } else if (params.manufacturer) {
    results = results.filter((m) =>
      m.manufacturer.toLowerCase().includes(params.manufacturer!.toLowerCase()),
    );
  }

  return results;
}

function toSummaryFromMock(m: (typeof MOCK_MATERIALS)[number]): MaterialSummary {
  const brand = resolveProductBrand({
    manufacturer: m.manufacturer,
    specs: m.specs as Record<string, unknown>,
    sourceUrl: m.sourceUrl,
  });

  return {
    id: m.id,
    name: m.name,
    slug: m.slug,
    category: m.category,
    manufacturer: m.manufacturer,
    manufacturerId: null,
    brand,
    description: m.description,
    imageUrl: m.imageUrl,
    tags: m.tags,
  };
}

function buildTextSearchOrClause(query: string): string {
  const pattern = `%${escapeIlikePattern(query)}%`;
  return [
    `name.ilike.${pattern}`,
    `manufacturer.ilike.${pattern}`,
    `category.ilike.${pattern}`,
    `description.ilike.${pattern}`,
    `slug.ilike.${pattern}`,
  ].join(",");
}

type MaterialsSelectQuery = ReturnType<
  ReturnType<SupabaseClient["from"]>["select"]
>;

function applySearchFilters(
  dbQuery: MaterialsSelectQuery,
  params: {
    query: string;
    explicitCategory?: MaterialCategory;
    categoryFromQuery?: MaterialCategory;
    manufacturer?: string;
    manufacturerId?: string;
  },
) {
  let query = dbQuery;

  if (params.explicitCategory) {
    const dbCategories = resolveCategoryDbValues(params.explicitCategory)!;
    query = query.in("category", dbCategories);
  } else if (params.categoryFromQuery) {
    const dbCategories = resolveCategoryDbValues(params.categoryFromQuery)!;
    query = query.in("category", dbCategories);
  } else if (params.query) {
    query = query.or(buildTextSearchOrClause(params.query));
  }

  if (params.manufacturerId) {
    query = query.eq("manufacturer_id", params.manufacturerId);
  } else if (params.manufacturer) {
    query = query.ilike(
      "manufacturer",
      `%${escapeIlikePattern(params.manufacturer)}%`,
    );
  }

  return query;
}

function mapSearchRows(rows: MaterialRow[]): {
  items: MaterialSummary[];
  hiddenDemoCount: number;
} {
  const activeRows = filterActiveMaterialRows(rows);
  const items = activeRows
    .map(mapMaterialSummary)
    .filter((item) => !isCatalogueDemoDuplicate(item));

  return {
    items,
    hiddenDemoCount: activeRows.length - items.length,
  };
}

function emptySearchResult(
  page: number,
  limit: number,
  query: string,
  total = 0,
): SearchResult {
  return {
    items: [],
    total,
    page,
    limit,
    query,
  };
}

function hasDatasheetIntelligenceFilters(params: SearchParams): boolean {
  return Boolean(
    params.fireRating?.trim() ||
      params.thickness?.trim() ||
      params.finish?.trim() ||
      params.thermalValue?.trim() ||
      params.certification?.trim(),
  );
}

/** Searches materials with optional filters and pagination. */
export async function searchMaterials(params: SearchParams): Promise<SearchResult> {
  const { page, limit, from, to } = normalizePagination(params.page, params.limit, 50);
  const query = params.q?.trim() ?? "";

  if (hasDatasheetIntelligenceFilters(params)) {
    const intelligenceResult = await searchDatasheetIntelligence({
      q: query || undefined,
      fireRating: params.fireRating,
      thickness: params.thickness,
      finish: params.finish,
      manufacturer: params.manufacturer,
      manufacturerId: params.manufacturerId,
      thermalValue: params.thermalValue,
      certification: params.certification,
      page,
      limit,
    });

    const items: MaterialSummary[] = intelligenceResult.items.map((hit) => ({
      id: hit.materialId,
      name: hit.materialName,
      slug: hit.materialSlug,
      category: hit.category as MaterialSummary["category"],
      manufacturer: hit.manufacturer,
      manufacturerId: null,
      brand: null,
      description: hit.aiSummary ?? "",
      imageUrl: hit.imageUrl,
      tags: hit.certifications,
    }));

    return {
      items,
      total: intelligenceResult.total,
      page: intelligenceResult.page,
      limit: intelligenceResult.limit,
      query,
    };
  }

  const categoryFromQuery = query ? resolveSearchQueryCategory(query) : undefined;
  const explicitCategory = params.category
    ? resolveCategoryFilter(params.category)
    : undefined;

  const supabase = getSupabaseServer();

  if (supabase) {
    const useActiveColumn = await hasMaterialsIsActiveColumn(supabase);
    const filterParams = {
      query,
      explicitCategory: explicitCategory as MaterialCategory | undefined,
      categoryFromQuery,
      manufacturer: params.manufacturer,
      manufacturerId: params.manufacturerId,
    };

    let countBuilder = supabase
      .from(DB_TABLES.materials)
      .select("*", { count: "exact", head: true });

    if (useActiveColumn) {
      countBuilder = countBuilder.eq("is_active", true);
    }

    const { count, error: countError } = await applySearchFilters(
      countBuilder,
      filterParams,
    );

    if (countError && !isRangeNotSatisfiableError(countError)) {
      raiseSupabaseError(countError, "searchMaterials(count)");
    }

    const total = count ?? 0;

    if (isRangeBeyondTotal(from, total)) {
      return emptySearchResult(page, limit, query, total);
    }

    const rangeEnd = clampRangeEnd(from, to, total);
    let dataBuilder = supabase.from(DB_TABLES.materials).select("*");

    if (useActiveColumn) {
      dataBuilder = dataBuilder.eq("is_active", true);
    }

    const { data, error } = await applySearchFilters(dataBuilder, filterParams)
      .order("name", { ascending: true })
      .range(from, rangeEnd);

    if (error) {
      if (isRangeNotSatisfiableError(error)) {
        return emptySearchResult(page, limit, query, total);
      }

      raiseSupabaseError(error, "searchMaterials(data)");
    }

    const { items, hiddenDemoCount } = mapSearchRows((data ?? []) as MaterialRow[]);

    return {
      items,
      total: Math.max(0, total - hiddenDemoCount),
      page,
      limit,
      query,
    };
  }

  const all = MOCK_MATERIALS.map(toSummaryFromMock).filter(
    (item) => !isCatalogueDemoDuplicate(item),
  );
  const filtered = filterMaterials(all, { ...params, page, limit });

  if (isRangeBeyondTotal(from, filtered.length)) {
    return emptySearchResult(page, limit, query, filtered.length);
  }

  return {
    items: filtered.slice(from, from + limit),
    total: filtered.length,
    page,
    limit,
    query,
  };
}
