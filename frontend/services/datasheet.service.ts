import { mapDatasheetRow } from "@/lib/mappers";
import { MOCK_DATASHEETS } from "@/lib/mock-data";
import { getSupabaseServer } from "@/lib/supabase";
import type { DatasheetRow } from "@/types/database";
import { DB_TABLES } from "@/types/database";
import type { Datasheet } from "@/types";

/** Fetches all available technical datasheets. */
export async function getDatasheets(): Promise<Datasheet[]> {
  const supabase = getSupabaseServer();

  if (supabase) {
    const { data, error } = await supabase
      .from(DB_TABLES.datasheets)
      .select("*")
      .order("published_at", { ascending: false });

    if (!error && data?.length) {
      return (data as DatasheetRow[]).map(mapDatasheetRow);
    }
  }

  return MOCK_DATASHEETS;
}

/** Fetches a single datasheet by ID. */
export async function getDatasheetById(id: string): Promise<Datasheet | null> {
  const supabase = getSupabaseServer();

  if (supabase) {
    const { data, error } = await supabase
      .from(DB_TABLES.datasheets)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!error && data) return mapDatasheetRow(data as DatasheetRow);
  }

  return MOCK_DATASHEETS.find((d) => d.id === id) ?? null;
}

/** Fetches datasheets for a specific material. */
export async function getDatasheetsByMaterialId(
  materialId: string,
): Promise<Datasheet[]> {
  const supabase = getSupabaseServer();

  if (supabase) {
    const { data, error } = await supabase
      .from(DB_TABLES.datasheets)
      .select("*")
      .eq("material_id", materialId);

    if (!error && data?.length) {
      return (data as DatasheetRow[]).map(mapDatasheetRow);
    }
  }

  return MOCK_DATASHEETS.filter((d) => d.materialId === materialId);
}
