import { ServiceError } from "@/lib/errors";
import { mapMaterialSummary } from "@/lib/mappers";
import { MOCK_MATERIALS } from "@/lib/mock-data";
import { getSupabaseServer } from "@/lib/supabase";
import type { MaterialRow } from "@/types/database";
import { DB_TABLES } from "@/types/database";
import type { MaterialSummary, SearchParams, SearchResult } from "@/types";

function filterMaterials(
  materials: MaterialSummary[],
  params: SearchParams,
): MaterialSummary[] {
  let results = [...materials];
  const query = params.q?.toLowerCase().trim();

  if (query) {
    results = results.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.manufacturer.toLowerCase().includes(query) ||
        m.category.toLowerCase().includes(query) ||
        m.description.toLowerCase().includes(query) ||
        m.tags.some((tag) => tag.toLowerCase().includes(query)),
    );
  }

  if (params.category) {
    results = results.filter(
      (m) => m.category.toLowerCase() === params.category!.toLowerCase(),
    );
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

/** Searches materials with optional filters and pagination. */
export async function searchMaterials(params: SearchParams): Promise<SearchResult> {
  const page = params.page ?? 1;
  const limit = Math.min(params.limit ?? 12, 50);
  const query = params.q?.trim() ?? "";

  if (page < 1) {
    throw new ServiceError("Page must be >= 1", "INVALID_REQUEST", 400);
  }

  const supabase = getSupabaseServer();

  if (supabase) {
    let dbQuery = supabase
      .from(DB_TABLES.materials)
      .select("*", { count: "exact" });

    if (query) {
      dbQuery = dbQuery.or(
        `name.ilike.%${query}%,manufacturer.ilike.%${query}%,description.ilike.%${query}%`,
      );
    }

    if (params.category) {
      dbQuery = dbQuery.eq("category", params.category);
    }

    if (params.manufacturer) {
      dbQuery = dbQuery.ilike("manufacturer", `%${params.manufacturer}%`);
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
