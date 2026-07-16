import { formatManufacturerGroupLabel } from "@/lib/manufacturer-catalog";
import { manufacturerIdentityKey } from "@/lib/manufacturer-identity";
import { manufacturerSlug } from "@/lib/manufacturer-slug";
import { normalizeMaterialCategory, MATERIAL_CATEGORIES } from "@/lib/material-categories";
import { listImportHistory } from "@/services/import-history.service";
import {
  loadManufacturerProductCounts,
  resolveRegistryProductCount,
} from "@/services/manufacturer-product-counts.service";
import { listManufacturerRegistry } from "@/services/manufacturer-registry.service";
import type { ImportHistoryRow } from "@/types/import-history";
import type {
  ManufacturerCategoryGroup,
  ManufacturerDirectoryEntry,
  ManufacturerDirectoryResult,
  ManufacturerImportStatus,
} from "@/types/manufacturer-directory";
import type { ManufacturerRegistryRow } from "@/types/manufacturer-registry";
import type { MaterialCategory } from "@/types/material";

function buildProductsHref(category: MaterialCategory, manufacturer: string): string {
  const params = new URLSearchParams();
  params.set("category", category);
  params.set("q", manufacturer);
  return `/search?${params.toString()}`;
}

function normalizeManufacturerKey(manufacturer: string): string {
  return manufacturerIdentityKey({ manufacturer });
}

function buildImportHistoryIndex(
  history: ImportHistoryRow[],
): Map<string, ImportHistoryRow> {
  const index = new Map<string, ImportHistoryRow>();

  for (const row of history) {
    const key = normalizeManufacturerKey(row.manufacturer);
    const existing = index.get(key);
    if (!existing) {
      index.set(key, row);
      continue;
    }

    const existingDate = existing.finished_at ?? existing.started_at;
    const rowDate = row.finished_at ?? row.started_at;
    if (rowDate > existingDate) {
      index.set(key, row);
    }
  }

  return index;
}

function resolveImportMeta(
  manufacturer: string,
  historyIndex: Map<string, ImportHistoryRow>,
  lastImportedAt?: string | null,
): { status: ManufacturerImportStatus; lastImportDate?: string } {
  const history = historyIndex.get(normalizeManufacturerKey(manufacturer));

  if (history) {
    return {
      status: history.status,
      lastImportDate: history.finished_at ?? history.started_at,
    };
  }

  if (lastImportedAt) {
    return {
      status: "catalogue",
      lastImportDate: lastImportedAt,
    };
  }

  return { status: "catalogue" };
}

function groupByCategory(
  manufacturers: ManufacturerDirectoryEntry[],
): ManufacturerCategoryGroup[] {
  const categoryMap = new Map<MaterialCategory, ManufacturerDirectoryEntry[]>();

  for (const entry of manufacturers) {
    if (!categoryMap.has(entry.category)) {
      categoryMap.set(entry.category, []);
    }
    categoryMap.get(entry.category)!.push(entry);
  }

  return MATERIAL_CATEGORIES.filter((category) => categoryMap.has(category)).map(
    (category) => {
      const items = categoryMap
        .get(category)!
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        category,
        manufacturers: items,
        totalProducts: items.reduce((sum, item) => sum + item.productCount, 0),
      };
    },
  );
}

function mapRegistryToDirectoryEntry(
  row: ManufacturerRegistryRow,
  productCount: number,
  historyIndex: Map<string, ImportHistoryRow>,
): ManufacturerDirectoryEntry {
  const category = normalizeMaterialCategory(row.category);
  const importMeta = resolveImportMeta(
    row.name,
    historyIndex,
    row.last_imported_at,
  );

  return {
    id: row.id,
    name: row.name,
    slug: row.slug || manufacturerSlug(row.name),
    category,
    productCount,
    country: row.country ?? undefined,
    logoUrl: row.logo_url ?? undefined,
    brand: row.brand ?? undefined,
    importStatus: importMeta.status,
    lastImportDate: importMeta.lastImportDate ?? undefined,
    productsHref: buildProductsHref(category, row.name),
    profileHref: `/manufacturers/${row.slug || manufacturerSlug(row.name)}`,
  };
}

export interface GetManufacturerDirectoryOptions {
  /** When true, manufacturers with zero products are omitted (public catalogue). */
  hideZeroProductManufacturers?: boolean;
}

/**
 * Builds the manufacturer directory from the manufacturers registry.
 * Product counts come from joining materials via manufacturer_id (name fallback).
 */
export async function getManufacturerDirectory(
  options: GetManufacturerDirectoryOptions = {},
): Promise<ManufacturerDirectoryResult> {
  const hideZero = options.hideZeroProductManufacturers ?? false;
  const registry = await listManufacturerRegistry();
  const counts = await loadManufacturerProductCounts();
  const history = await listImportHistory(500).catch(() => []);
  const historyIndex = buildImportHistoryIndex(history);

  const manufacturers: ManufacturerDirectoryEntry[] = registry
    .map((row) => {
      const productCount = resolveRegistryProductCount(row, counts);
      return mapRegistryToDirectoryEntry(row, productCount, historyIndex);
    })
    .filter((entry) => !hideZero || entry.productCount > 0);

  const groups = groupByCategory(manufacturers);

  return {
    groups,
    totalManufacturers: manufacturers.length,
    totalProducts: manufacturers.reduce((sum, item) => sum + item.productCount, 0),
    source: "registry",
  };
}

/** Display helper used by Materials browser cards. */
export function registryDisplayName(row: ManufacturerRegistryRow): string {
  return formatManufacturerGroupLabel(
    row.name,
    row.brand ? [row.brand] : [],
  );
}
