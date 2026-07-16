import { ServiceError } from "@/lib/errors";
import { isCatalogueDemoDuplicate } from "@/lib/manufacturer-catalog";
import { mapMaterialRow, mapMaterialSummary } from "@/lib/mappers";
import {
  filterActiveMaterialRows,
  hasMaterialsIsActiveColumn,
  isActiveMaterialRow,
} from "@/lib/materials-schema";
import { raiseSupabaseError } from "@/lib/supabase-errors";
import { resolveCategoryDbValues } from "@/lib/material-categories";
import {
  clampRangeEnd,
  isInvalidRangeWindow,
  isRangeNotSatisfiableError,
  normalizePagination,
} from "@/lib/pagination";
import { getMockMaterialById, MOCK_MATERIALS } from "@/lib/mock-data";
import { getSupabaseServer } from "@/lib/supabase";
import { resolveManufacturerIdentity } from "@/services/manufacturer-identity.service";
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
    manufacturerId: material.manufacturerId,
    brand: material.brand,
    description: material.description,
    imageUrl: material.imageUrl,
    tags: material.tags,
  };
}

function handleSupabaseError(
  error: { message?: string; code?: string; details?: string; hint?: string },
  context: string,
): never {
  raiseSupabaseError(error, context);
}

export interface MaterialsListResult {
  items: MaterialSummary[];
  total: number;
  page: number;
  limit: number;
}

function emptyMaterialsResult(
  page: number,
  limit: number,
  total = 0,
): MaterialsListResult {
  return { items: [], total, page, limit };
}

/** Fetches all materials — Supabase when configured, mock data otherwise. */
export async function getAllMaterials(options?: {
  category?: string;
  page?: number;
  limit?: number;
}): Promise<MaterialsListResult> {
  const { page, limit, from, to } = normalizePagination(
    options?.page,
    options?.limit ?? 50,
    50,
  );
  const supabase = getSupabaseServer();

  if (supabase) {
    const useActiveColumn = await hasMaterialsIsActiveColumn(supabase);

    let countQuery = supabase
      .from(DB_TABLES.materials)
      .select("*", { count: "exact", head: true });

    if (useActiveColumn) {
      countQuery = countQuery.eq("is_active", true);
    }

    if (options?.category) {
      const dbCategories = resolveCategoryDbValues(options.category)!;
      countQuery = countQuery.in("category", dbCategories);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      if (isRangeNotSatisfiableError(countError)) {
        return emptyMaterialsResult(page, limit, 0);
      }

      handleSupabaseError(countError, "getAllMaterials");
    }

    const total = count ?? 0;

    if (isInvalidRangeWindow(from, to, total)) {
      return emptyMaterialsResult(page, limit, total);
    }

    let dataQuery = supabase.from(DB_TABLES.materials).select("*");

    if (useActiveColumn) {
      dataQuery = dataQuery.eq("is_active", true);
    }

    dataQuery = dataQuery.order("name", { ascending: true });

    if (options?.category) {
      const dbCategories = resolveCategoryDbValues(options.category)!;
      dataQuery = dataQuery.in("category", dbCategories);
    }

    const rangeEnd = clampRangeEnd(from, to, total);

    if (rangeEnd < from) {
      return emptyMaterialsResult(page, limit, total);
    }

    const { data, error } = await dataQuery.range(from, rangeEnd);

    if (error) {
      if (isRangeNotSatisfiableError(error)) {
        return emptyMaterialsResult(page, limit, total);
      }

      handleSupabaseError(error, "getAllMaterials");
    }

    return {
      items: filterActiveMaterialRows(data as MaterialRow[])
        .map(mapMaterialSummary)
        .filter((item) => !isCatalogueDemoDuplicate(item)),
      total,
      page,
      limit,
    };
  }

  let items = MOCK_MATERIALS.map(toSummary).filter(
    (item) => !isCatalogueDemoDuplicate(item),
  );

  if (options?.category) {
    const dbCategories = resolveCategoryDbValues(options.category)!;
    items = items.filter((m) => dbCategories.includes(m.category));
  }

  const total = items.length;

  if (isInvalidRangeWindow(from, to, total)) {
    return emptyMaterialsResult(page, limit, total);
  }

  return {
    items: items.slice(from, from + limit),
    total,
    page,
    limit,
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
  const identity = await resolveManufacturerIdentity({
    manufacturerId: material.manufacturerId ?? undefined,
    rawName: material.manufacturer,
    sourceUrl: material.sourceUrl ?? undefined,
  });

  if (supabase) {
    const useActiveColumn = await hasMaterialsIsActiveColumn(supabase);

    let relatedQuery = supabase.from(DB_TABLES.materials).select("*");

    if (useActiveColumn) {
      relatedQuery = relatedQuery.eq("is_active", true);
    }

    if (identity.manufacturerId) {
      relatedQuery = relatedQuery.eq("manufacturer_id", identity.manufacturerId);
    } else {
      relatedQuery = relatedQuery.eq("manufacturer", identity.canonicalName);
    }

    const { data, error } = await relatedQuery
      .neq("slug", material.slug)
      .order("name", { ascending: true })
      .limit(limit);

    if (error) handleSupabaseError(error, "getRelatedMaterials");

    return filterActiveMaterialRows(data as MaterialRow[])
      .map(mapMaterialSummary)
      .filter((item) => !isCatalogueDemoDuplicate(item));
  }

  return MOCK_MATERIALS.map(toSummary)
    .filter(
      (item) =>
        !isCatalogueDemoDuplicate(item) &&
        item.manufacturer === identity.canonicalName &&
        item.slug !== material.slug,
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** Returns how many catalogue products exist for a manufacturer. */
export async function getManufacturerProductCount(
  manufacturer: string,
  sourceUrl?: string | null,
  manufacturerId?: string | null,
): Promise<number> {
  const supabase = getSupabaseServer();
  const identity = await resolveManufacturerIdentity({
    manufacturerId: manufacturerId ?? undefined,
    rawName: manufacturer,
    sourceUrl: sourceUrl ?? undefined,
  });

  if (supabase) {
    const useActiveColumn = await hasMaterialsIsActiveColumn(supabase);

    let countQuery = supabase.from(DB_TABLES.materials).select("slug, manufacturer_id");

    if (useActiveColumn) {
      countQuery = countQuery.eq("is_active", true);
    }

    if (identity.manufacturerId) {
      countQuery = countQuery.eq("manufacturer_id", identity.manufacturerId);
    } else {
      countQuery = countQuery.eq("manufacturer", identity.canonicalName);
    }

    const { data, error } = await countQuery;

    if (error) handleSupabaseError(error, "getManufacturerProductCount");

    return (data ?? []).filter((row) => {
      const record = row as Pick<MaterialRow, "slug">;
      return !isCatalogueDemoDuplicate(record);
    }).length;
  }

  return MOCK_MATERIALS.filter(
    (item) =>
      !isCatalogueDemoDuplicate(item) &&
      item.manufacturer === identity.canonicalName,
  ).length;
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

    const row = data as MaterialRow;
    const material = mapMaterialRow(row);
    if (isCatalogueDemoDuplicate(material)) return null;
    if (!isActiveMaterialRow(row)) return null;

    return material;
  }

  return getMockMaterialById(id) ?? null;
}

/** Fetches multiple materials by IDs (used by compare feature). */
export async function getMaterialsByIds(ids: string[]): Promise<Material[]> {
  const supabase = getSupabaseServer();

  if (supabase) {
    const useActiveColumn = await hasMaterialsIsActiveColumn(supabase);

    let materialsQuery = supabase.from(DB_TABLES.materials).select("*");

    if (useActiveColumn) {
      materialsQuery = materialsQuery.eq("is_active", true);
    }

    const { data, error } = await materialsQuery.in("id", ids);

    if (error) handleSupabaseError(error, "getMaterialsByIds");
    return filterActiveMaterialRows(data as MaterialRow[]).map(mapMaterialRow);
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
