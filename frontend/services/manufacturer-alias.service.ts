import { normalizeIdentityToken } from "@/lib/manufacturer-identity";
import { ServiceError } from "@/lib/errors";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { DB_TABLES } from "@/types/database";

export interface ManufacturerAliasRow {
  id: string;
  manufacturer_id: string;
  alias: string;
  created_at: string;
}

function requireSupabase() {
  const supabase = getSupabaseServer();
  if (!supabase) {
    throw new ServiceError(
      "Supabase is not configured.",
      "SUPABASE_NOT_CONFIGURED",
      503,
    );
  }
  return supabase;
}

function isMissingAliasesTable(message?: string): boolean {
  return Boolean(
    message?.includes("manufacturer_aliases") &&
      (message.includes("Could not find the table") ||
        message.includes("does not exist")),
  );
}

function dedupeAliases(aliases: string[], canonicalName?: string): string[] {
  const canonical = canonicalName ? normalizeIdentityToken(canonicalName) : "";
  const seen = new Set<string>();

  return aliases
    .map((alias) => alias.trim())
    .filter((alias) => {
      if (!alias) return false;
      const key = normalizeIdentityToken(alias);
      if (canonical && key === canonical) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Loads all aliases grouped by manufacturer id. */
export async function loadManufacturerAliasMap(): Promise<Map<string, string[]>> {
  if (!isSupabaseConfigured()) {
    return new Map();
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(DB_TABLES.manufacturerAliases)
    .select("manufacturer_id, alias")
    .order("alias", { ascending: true });

  if (error) {
    if (isMissingAliasesTable(error.message)) {
      return new Map();
    }

    console.error("[manufacturer-alias] Load failed:", error.message);
    return new Map();
  }

  const map = new Map<string, string[]>();

  for (const row of data ?? []) {
    const entry = row as Pick<ManufacturerAliasRow, "manufacturer_id" | "alias">;
    const existing = map.get(entry.manufacturer_id) ?? [];
    existing.push(entry.alias);
    map.set(entry.manufacturer_id, existing);
  }

  return map;
}

/** Replaces aliases for a manufacturer and syncs the legacy array column. */
export async function syncManufacturerAliases(
  manufacturerId: string,
  aliases: string[],
  canonicalName?: string,
): Promise<string[]> {
  if (!isSupabaseConfigured()) {
    return dedupeAliases(aliases, canonicalName);
  }

  const normalizedAliases = dedupeAliases(aliases, canonicalName);
  const supabase = requireSupabase();

  const { error: deleteError } = await supabase
    .from(DB_TABLES.manufacturerAliases)
    .delete()
    .eq("manufacturer_id", manufacturerId);

  if (deleteError) {
    if (isMissingAliasesTable(deleteError.message)) {
      return normalizedAliases;
    }

    throw new ServiceError(
      `Failed to clear manufacturer aliases: ${deleteError.message}`,
      "MANUFACTURER_ALIAS_SYNC_FAILED",
      500,
    );
  }

  if (normalizedAliases.length > 0) {
    const { error: insertError } = await supabase.from(DB_TABLES.manufacturerAliases).insert(
      normalizedAliases.map((alias) => ({
        manufacturer_id: manufacturerId,
        alias,
      })),
    );

    if (insertError) {
      if (insertError.code === "23505" || /duplicate key/i.test(insertError.message)) {
        throw new ServiceError(
          "One or more aliases already belong to another manufacturer.",
          "MANUFACTURER_ALIAS_DUPLICATE",
          409,
        );
      }

      throw new ServiceError(
        `Failed to save manufacturer aliases: ${insertError.message}`,
        "MANUFACTURER_ALIAS_SYNC_FAILED",
        500,
      );
    }
  }

  const { error: syncArrayError } = await supabase
    .from(DB_TABLES.manufacturers)
    .update({
      aliases: normalizedAliases,
      updated_at: new Date().toISOString(),
    })
    .eq("id", manufacturerId);

  if (syncArrayError && !isMissingAliasesTable(syncArrayError.message)) {
    console.error(
      "[manufacturer-alias] Failed to sync legacy aliases array:",
      syncArrayError.message,
    );
  }

  return normalizedAliases;
}

/** Finds a manufacturer id by alias token. */
export async function findManufacturerIdByAlias(alias: string): Promise<string | null> {
  if (!isSupabaseConfigured() || !alias.trim()) {
    return null;
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(DB_TABLES.manufacturerAliases)
    .select("manufacturer_id")
    .ilike("alias", alias.trim())
    .maybeSingle();

  if (error) {
    if (isMissingAliasesTable(error.message)) {
      return null;
    }

    console.error("[manufacturer-alias] Lookup failed:", error.message);
    return null;
  }

  return (data as { manufacturer_id: string } | null)?.manufacturer_id ?? null;
}
