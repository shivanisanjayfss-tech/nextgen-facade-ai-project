import {
  getManufacturerCatalogueMatchNames,
  resolveCanonicalManufacturer,
} from "@/lib/manufacturer-catalog";
import { manufacturerSlug, manufacturerSlugMatches } from "@/lib/manufacturer-slug";
import { normalizeMaterialCategory } from "@/lib/material-categories";
import { mapMaterialSummary } from "@/lib/mappers";
import { filterActiveMaterialRows } from "@/lib/materials-schema";
import { ServiceError } from "@/lib/errors";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import {
  getManufacturerRegistryBySlug,
  listManufacturerRegistry,
} from "@/services/manufacturer-registry.service";
import type { ManufacturerRegistryRow } from "@/types/manufacturer-registry";
import { listImportHistory } from "@/services/import-history.service";
import type { MaterialRow } from "@/types/database";
import { DB_TABLES } from "@/types/database";
import type { MaterialCategory } from "@/types/material";
import type { ManufacturerProfile } from "@/types/manufacturer-profile";
import type { MaterialSummary } from "@/types";

function resolveManufacturerNameFromSlug(
  slug: string,
  configuredRows: ManufacturerRegistryRow[],
): string | null {
  const configMatch = configuredRows.find(
    (row) => row.slug === slug || manufacturerSlugMatches(row.name, slug),
  );
  if (configMatch) return configMatch.name;

  for (const row of configuredRows) {
    if (manufacturerSlugMatches(row.name, slug)) {
      return row.name;
    }
  }

  return null;
}

async function fetchManufacturerProductCount(
  manufacturerName: string,
  manufacturerId?: string,
): Promise<number> {
  const supabase = getSupabaseServer();
  if (!supabase) return 0;

  if (manufacturerId) {
    const { count, error } = await supabase
      .from(DB_TABLES.materials)
      .select("*", { count: "exact", head: true })
      .eq("manufacturer_id", manufacturerId);

    if (!error && count !== null) {
      return count;
    }
  }

  const matchNames = getManufacturerCatalogueMatchNames(manufacturerName);
  const { count, error } = await supabase
    .from(DB_TABLES.materials)
    .select("*", { count: "exact", head: true })
    .in("manufacturer", matchNames);

  if (error) return 0;
  return count ?? 0;
}

async function fetchManufacturerProducts(
  manufacturerName: string,
  limit = 24,
  manufacturerId?: string,
): Promise<MaterialSummary[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];

  if (manufacturerId) {
    const { data, error } = await supabase
      .from(DB_TABLES.materials)
      .select("*")
      .eq("manufacturer_id", manufacturerId)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (!error && data?.length) {
      return filterActiveMaterialRows((data ?? []) as MaterialRow[]).map(mapMaterialSummary);
    }
  }

  const matchNames = getManufacturerCatalogueMatchNames(manufacturerName);
  const { data, error } = await supabase
    .from(DB_TABLES.materials)
    .select("*")
    .in("manufacturer", matchNames)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new ServiceError(
      `Failed to load manufacturer products: ${error.message}`,
      "MANUFACTURER_PRODUCTS_READ_FAILED",
      500,
    );
  }

  return filterActiveMaterialRows((data ?? []) as MaterialRow[]).map(mapMaterialSummary);
}

/** Loads a dynamic manufacturer profile by URL slug. */
export async function getManufacturerProfile(
  slug: string,
): Promise<ManufacturerProfile | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return null;

  const [config, configuredRows, history] = await Promise.all([
    getManufacturerRegistryBySlug(normalizedSlug),
    listManufacturerRegistry(),
    listImportHistory(200).catch(() => []),
  ]);

  const manufacturerName =
    config?.name ?? resolveManufacturerNameFromSlug(normalizedSlug, configuredRows);

  if (!manufacturerName && isSupabaseConfigured()) {
    const supabase = getSupabaseServer();
    if (supabase) {
      const { data } = await supabase
        .from(DB_TABLES.materials)
        .select("manufacturer")
        .limit(500);

      const names = new Set(
        ((data ?? []) as Array<{ manufacturer: string }>).map((row) =>
          resolveCanonicalManufacturer(row.manufacturer),
        ),
      );

      for (const name of names) {
        if (manufacturerSlugMatches(name, normalizedSlug)) {
          return buildManufacturerProfile(name, null, configuredRows, history);
        }
      }
    }
  }

  if (!manufacturerName) return null;

  return buildManufacturerProfile(
    manufacturerName,
    config,
    configuredRows,
    history,
  );
}

async function buildManufacturerProfile(
  manufacturerName: string,
  config: ManufacturerRegistryRow | null,
  _configuredRows: ManufacturerRegistryRow[],
  history: Awaited<ReturnType<typeof listImportHistory>>,
): Promise<ManufacturerProfile> {
  const normalizedSlug = manufacturerSlug(manufacturerName);
  const [products, productCount] = await Promise.all([
    fetchManufacturerProducts(manufacturerName, 24, config?.id),
    fetchManufacturerProductCount(manufacturerName, config?.id),
  ]);
  const categories = Array.from(
    new Set(products.map((product) => normalizeMaterialCategory(product.category))),
  ) as MaterialCategory[];

  const historyMatch = history
    .filter((row) => manufacturerSlugMatches(row.manufacturer, normalizedSlug))
    .sort(
      (a, b) =>
        new Date(b.finished_at ?? b.started_at).getTime() -
        new Date(a.finished_at ?? a.started_at).getTime(),
    )[0];

  const logoFromProduct = products.find((product) => product.imageUrl)?.imageUrl;

  return {
    slug: config?.slug ?? normalizedSlug,
    name: manufacturerName,
    brand: config?.brand ?? undefined,
    description: config?.description ?? undefined,
    websiteUrl: config?.website ?? undefined,
    logoUrl: config?.logo_url ?? logoFromProduct ?? undefined,
    country: config?.country ?? undefined,
    categories,
    productCount: config?.total_products && config.total_products > 0
      ? config.total_products
      : productCount,
    products,
    importStatus: (config?.last_status as ManufacturerProfile["importStatus"]) ??
      historyMatch?.status ??
      "catalogue",
    lastImportDate:
      config?.last_imported_at ??
      historyMatch?.finished_at ??
      historyMatch?.started_at,
    lastImportStats: historyMatch
      ? {
          imported: historyMatch.imported,
          updated: historyMatch.updated,
          skipped: historyMatch.skipped,
          failed: historyMatch.failed,
        }
      : undefined,
    configured: Boolean(config),
    strategyKey: config?.import_strategy,
    autoImport: config?.auto_import ?? false,
    enabled: config?.enabled ?? false,
  };
}
