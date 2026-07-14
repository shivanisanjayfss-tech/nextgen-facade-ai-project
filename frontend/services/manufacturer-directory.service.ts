import { normalizeMaterialCategory, MATERIAL_CATEGORIES } from "@/lib/material-categories";
import { MOCK_MATERIALS } from "@/lib/mock-data";
import { getSupabaseServer } from "@/lib/supabase";
import { listImportHistory } from "@/services/import-history.service";
import type { MaterialRow } from "@/types/database";
import { DB_TABLES } from "@/types/database";
import type { ImportHistoryRow } from "@/types/import-history";
import type {
  ManufacturerCategoryGroup,
  ManufacturerDirectoryEntry,
  ManufacturerDirectoryResult,
  ManufacturerImportStatus,
} from "@/types/manufacturer-directory";
import type { MaterialCategory } from "@/types/material";

const COUNTRY_SPEC_KEYS = [
  "manufacturerCountry",
  "manufacturer_country",
  "country",
] as const;

const LOGO_SPEC_KEYS = [
  "manufacturerLogo",
  "manufacturer_logo",
  "logo",
  "logoUrl",
  "logo_url",
] as const;

interface MaterialAggregateRow {
  category: string;
  manufacturer: string;
  specs: Record<string, unknown>;
  image_url: string | null;
  updated_at: string;
}

interface ManufacturerAggregate {
  name: string;
  category: MaterialCategory;
  productCount: number;
  country?: string;
  logoUrl?: string;
  latestProductUpdate?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function findSpecText(specs: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = specs[key];
    if (isNonEmptyString(value)) return value.trim();
  }
  return undefined;
}

function buildProductsHref(category: MaterialCategory, manufacturer: string): string {
  const params = new URLSearchParams();
  params.set("category", category);
  params.set("q", manufacturer);
  return `/search?${params.toString()}`;
}

function normalizeManufacturerKey(name: string): string {
  return name.trim().toLowerCase();
}

function aggregateManufacturers(rows: MaterialAggregateRow[]): ManufacturerAggregate[] {
  const map = new Map<string, ManufacturerAggregate>();

  for (const row of rows) {
    const category = normalizeMaterialCategory(row.category);
    const name = row.manufacturer.trim();
    const key = `${category}::${normalizeManufacturerKey(name)}`;
    const specs = row.specs ?? {};

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        name,
        category,
        productCount: 1,
        country: findSpecText(specs, COUNTRY_SPEC_KEYS),
        logoUrl: findSpecText(specs, LOGO_SPEC_KEYS),
        latestProductUpdate: row.updated_at,
      });
      continue;
    }

    existing.productCount += 1;

    if (!existing.country) {
      existing.country = findSpecText(specs, COUNTRY_SPEC_KEYS);
    }

    if (!existing.logoUrl) {
      existing.logoUrl = findSpecText(specs, LOGO_SPEC_KEYS);
    }

    if (
      !existing.latestProductUpdate ||
      row.updated_at > existing.latestProductUpdate
    ) {
      existing.latestProductUpdate = row.updated_at;
    }
  }

  return Array.from(map.values());
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
): { status: ManufacturerImportStatus; lastImportDate?: string } {
  const history = historyIndex.get(normalizeManufacturerKey(manufacturer));

  if (!history) {
    return { status: "catalogue" };
  }

  return {
    status: history.status,
    lastImportDate: history.finished_at ?? history.started_at,
  };
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

async function fetchAllMaterialAggregateRows(): Promise<MaterialAggregateRow[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];

  const pageSize = 100;
  const rows: MaterialAggregateRow[] = [];
  let page = 0;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from(DB_TABLES.materials)
      .select("category, manufacturer, specs, image_url, updated_at")
      .order("manufacturer", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to load materials for manufacturer directory: ${error.message}`);
    }

    if (!data?.length) break;

    rows.push(...(data as MaterialAggregateRow[]));

    if (data.length < pageSize) break;
    page += 1;
  }

  return rows;
}

function mockMaterialAggregateRows(): MaterialAggregateRow[] {
  return MOCK_MATERIALS.map((material) => ({
    category: material.category,
    manufacturer: material.manufacturer,
    specs: material.specs as Record<string, unknown>,
    image_url: material.imageUrl ?? null,
    updated_at: material.updatedAt,
  }));
}

/** Builds the manufacturer directory dynamically from imported materials. */
export async function getManufacturerDirectory(): Promise<ManufacturerDirectoryResult> {
  let rows = await fetchAllMaterialAggregateRows();
  if (rows.length === 0) {
    rows = mockMaterialAggregateRows();
  }

  const aggregates = aggregateManufacturers(rows);
  const history = await listImportHistory(500).catch(() => []);
  const historyIndex = buildImportHistoryIndex(history);

  const manufacturers: ManufacturerDirectoryEntry[] = aggregates.map((aggregate) => {
    const importMeta = resolveImportMeta(aggregate.name, historyIndex);

    return {
      name: aggregate.name,
      category: aggregate.category,
      productCount: aggregate.productCount,
      country: aggregate.country,
      logoUrl: aggregate.logoUrl,
      importStatus: importMeta.status,
      lastImportDate: importMeta.lastImportDate ?? aggregate.latestProductUpdate,
      productsHref: buildProductsHref(aggregate.category, aggregate.name),
    };
  });

  const groups = groupByCategory(manufacturers);

  return {
    groups,
    totalManufacturers: manufacturers.length,
    totalProducts: manufacturers.reduce((sum, item) => sum + item.productCount, 0),
  };
}
