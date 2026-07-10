import { ServiceError } from "@/lib/errors";
import { mapMaterialRow, mapMaterialSummary } from "@/lib/mappers";
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
      query = query.eq("category", options.category);
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
    items = items.filter(
      (m) => m.category.toLowerCase() === options.category!.toLowerCase(),
    );
  }

  const from = (page - 1) * limit;
  return {
    items: items.slice(from, from + limit),
    total: items.length,
  };
}

/** Fetches a single material by ID or slug. */
export async function getMaterialById(id: string): Promise<Material | null> {
  const supabase = getSupabaseServer();

  if (supabase) {
    const { data, error } = await supabase
      .from(DB_TABLES.materials)
      .select("*")
      .or(`id.eq.${id},slug.eq.${id}`)
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
