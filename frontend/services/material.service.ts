import { ServiceError } from "@/lib/errors";
import { mapMaterialRow, mapMaterialSummary } from "@/lib/mappers";
import { resolveCategoryDbValues } from "@/lib/material-categories";
import { getMockMaterialById, MOCK_MATERIALS } from "@/lib/mock-data";
import { getSupabaseServer } from "@/lib/supabase";
import type { MaterialRow } from "@/types/database";
import { DB_TABLES } from "@/types/database";
import type { Material, MaterialSummary } from "@/types";

function toSummary(material: Material): MaterialSummary {
  return {
    id: material.id,
    name: material.name,
    slug: material.slug,
    category: material.category,
    manufacturer: material.manufacturer,
    description: material.description,
    imageUrl: material.imageUrl,
    tags: material.tags,
  };
}

function handleSupabaseError(error: { message: string }, context: string): never {
  throw new ServiceError(error.message, "DATABASE_ERROR", 500);
}

/** Fetches all materials — Supabase when configured, mock data otherwise. */
export async function getAllMaterials(options?: {
  category?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: MaterialSummary[]; total: number }> {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 50;
  const supabase = getSupabaseServer();

  if (supabase) {
    let query = supabase
      .from(DB_TABLES.materials)
      .select("*", { count: "exact" })
      .order("name", { ascending: true });

    if (options?.category) {
      const dbCategories = resolveCategoryDbValues(options.category)!;
      query = query.in("category", dbCategories);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) handleSupabaseError(error, "getAllMaterials");

    return {
      items: (data as MaterialRow[]).map(mapMaterialSummary),
      total: count ?? data?.length ?? 0,
    };
  }

  let items = MOCK_MATERIALS.map(toSummary);

  if (options?.category) {
    const dbCategories = resolveCategoryDbValues(options.category)!;
    items = items.filter((m) => dbCategories.includes(m.category));
  }

  const from = (page - 1) * limit;
  return {
    items: items.slice(from, from + limit),
    total: items.length,
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/** Fetches related materials from the same manufacturer. */
export async function getRelatedMaterials(
  material: Material,
  limit = 24,
): Promise<MaterialSummary[]> {
  const supabase = getSupabaseServer();

  if (supabase) {
    const { data, error } = await supabase
      .from(DB_TABLES.materials)
      .select("*")
      .eq("manufacturer", material.manufacturer)
      .neq("slug", material.slug)
      .order("name", { ascending: true })
      .limit(limit);

    if (error) handleSupabaseError(error, "getRelatedMaterials");
    return (data as MaterialRow[]).map(mapMaterialSummary);
  }

  return MOCK_MATERIALS.map(toSummary)
    .filter(
      (item) =>
        item.manufacturer === material.manufacturer && item.slug !== material.slug,
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** Returns how many catalogue products exist for a manufacturer. */
export async function getManufacturerProductCount(manufacturer: string): Promise<number> {
  const supabase = getSupabaseServer();

  if (supabase) {
    const { count, error } = await supabase
      .from(DB_TABLES.materials)
      .select("*", { count: "exact", head: true })
      .eq("manufacturer", manufacturer);

    if (error) handleSupabaseError(error, "getManufacturerProductCount");
    return count ?? 0;
  }

  return MOCK_MATERIALS.filter((item) => item.manufacturer === manufacturer).length;
}

/** Fetches a single material by ID or slug. */
export async function getMaterialById(id: string): Promise<Material | null> {
  const supabase = getSupabaseServer();

  if (supabase) {
    const column = isUuid(id) ? "id" : "slug";
    const { data, error } = await supabase
      .from(DB_TABLES.materials)
      .select("*")
      .eq(column, id)
      .maybeSingle();

    if (error) handleSupabaseError(error, "getMaterialById");
    if (!data) return null;

    return mapMaterialRow(data as MaterialRow);
  }

  return getMockMaterialById(id) ?? null;
}

/** Fetches multiple materials by IDs (used by compare feature). */
export async function getMaterialsByIds(ids: string[]): Promise<Material[]> {
  const supabase = getSupabaseServer();

  if (supabase) {
    const { data, error } = await supabase
      .from(DB_TABLES.materials)
      .select("*")
      .in("id", ids);

    if (error) handleSupabaseError(error, "getMaterialsByIds");
    return (data as MaterialRow[]).map(mapMaterialRow);
  }

  return MOCK_MATERIALS.filter((m) => ids.includes(m.id));
}

/** Requires a material to exist — throws 404 ServiceError if not found. */
export async function requireMaterialById(id: string): Promise<Material> {
  const material = await getMaterialById(id);
  if (!material) {
    throw new ServiceError(`Material "${id}" not found`, "NOT_FOUND", 404);
  }
  return material;
}
