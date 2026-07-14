import { ServiceError } from "@/lib/errors";
import { mapMaterialSummary } from "@/lib/mappers";
import {
  resolveCategoryDbValues,
  resolveCategoryFilter,
  resolveSearchQueryCategory,
} from "@/lib/material-categories";
import { MOCK_MATERIALS } from "@/lib/mock-data";
import { getSupabaseServer } from "@/lib/supabase";
import type { MaterialRow } from "@/types/database";
import { DB_TABLES } from "@/types/database";
import type { MaterialCategory } from "@/types/material";
import type { MaterialSummary, SearchParams, SearchResult } from "@/types";

/** Escapes special characters for PostgREST ilike patterns. */
function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

function materialMatchesTextQuery(material: MaterialSummary, query: string): boolean {
  const needle = query.toLowerCase();

  return (
    material.name.toLowerCase().includes(needle) ||
    material.manufacturer.toLowerCase().includes(needle) ||
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

  if (params.manufacturer) {
    results = results.filter((m) =>
      m.manufacturer.toLowerCase().includes(params.manufacturer!.toLowerCase()),
    );
  }

  return results;
}

function toSummaryFromMock(m: (typeof MOCK_MATERIALS)[number]): MaterialSummary {
  return {
    id: m.id,
    name: m.name,
    slug: m.slug,
    category: m.category,
    manufacturer: m.manufacturer,
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

/** Searches materials with optional filters and pagination. */
export async function searchMaterials(params: SearchParams): Promise<SearchResult> {
  const page = params.page ?? 1;
  const limit = Math.min(params.limit ?? 12, 50);
  const query = params.q?.trim() ?? "";

  if (page < 1) {
    throw new ServiceError("Page must be >= 1", "INVALID_REQUEST", 400);
  }

  const categoryFromQuery = query ? resolveSearchQueryCategory(query) : undefined;
  const explicitCategory = params.category
    ? resolveCategoryFilter(params.category)
    : undefined;

  const supabase = getSupabaseServer();

  if (supabase) {
    let dbQuery = supabase
      .from(DB_TABLES.materials)
      .select("*", { count: "exact" });

    if (explicitCategory) {
      const dbCategories = resolveCategoryDbValues(explicitCategory)!;
      dbQuery = dbQuery.in("category", dbCategories);
    } else if (categoryFromQuery) {
      const dbCategories = resolveCategoryDbValues(categoryFromQuery)!;
      dbQuery = dbQuery.in("category", dbCategories);
    } else if (query) {
      dbQuery = dbQuery.or(buildTextSearchOrClause(query));
    }

    if (params.manufacturer) {
      dbQuery = dbQuery.ilike("manufacturer", `%${escapeIlikePattern(params.manufacturer)}%`);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await dbQuery
      .order("name", { ascending: true })
      .range(from, to);

    if (error) {
      throw new ServiceError(error.message, "DATABASE_ERROR", 500);
    }

    return {
      items: (data as MaterialRow[]).map(mapMaterialSummary),
      total: count ?? data?.length ?? 0,
      page,
      limit,
      query,
    };
  }

  const all = MOCK_MATERIALS.map(toSummaryFromMock);
  const filtered = filterMaterials(all, params);
  const start = (page - 1) * limit;

  return {
    items: filtered.slice(start, start + limit),
    total: filtered.length,
    page,
    limit,
    query,
  };
}
