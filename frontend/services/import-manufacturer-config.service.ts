import {
  buildManufacturerImportQueue,
  countManufacturerImportQueue,
  getManufacturerRegistryBySlug,
  listManufacturerRegistry,
  recordManufacturerImportComplete,
  updateManufacturerRegistry,
} from "@/services/manufacturer-registry.service";
import type { ImportManufacturerRow } from "@/types/import-scheduler";
import type {
  ManufacturerRegistryRow,
  UpdateManufacturerRegistryInput,
} from "@/types/manufacturer-registry";
import type { ScheduledManufacturer } from "@/types/import-scheduler";

function mapRegistryToLegacyRow(row: ManufacturerRegistryRow): ImportManufacturerRow {
  return {
    id: row.id,
    manufacturer: row.name,
    brand: row.brand,
    website_url: row.website,
    category: row.category,
    enabled: row.enabled,
    auto_import: row.auto_import,
    strategy_key: row.import_strategy,
    logo_url: row.logo_url,
    description: row.description,
    country: row.country,
    slug: row.slug,
    sort_order: 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** @deprecated Use buildManufacturerImportQueue from manufacturer-registry.service. */
export async function buildImportQueue(): Promise<ScheduledManufacturer[]> {
  return buildManufacturerImportQueue();
}

/** @deprecated Use buildManufacturerImportQueue. */
export async function getEnabledImportManufacturers(): Promise<ScheduledManufacturer[]> {
  return buildManufacturerImportQueue();
}

/** @deprecated Use countManufacturerImportQueue. */
export async function countImportQueueManufacturers(): Promise<number> {
  return countManufacturerImportQueue();
}

/** Returns registry rows mapped for legacy admin components. */
export async function listImportManufacturers(): Promise<ImportManufacturerRow[]> {
  const rows = await listManufacturerRegistry();
  return rows.map(mapRegistryToLegacyRow);
}

/** @deprecated Use getManufacturerRegistryBySlug. */
export async function getImportManufacturerBySlug(
  slug: string,
): Promise<ImportManufacturerRow | null> {
  const row = await getManufacturerRegistryBySlug(slug);
  return row ? mapRegistryToLegacyRow(row) : null;
}

/** @deprecated Use updateManufacturerRegistry. */
export async function updateImportManufacturer(
  id: string,
  input: UpdateManufacturerRegistryInput & {
    strategy_key?: string;
    website_url?: string;
    logo_url?: string | null;
  },
): Promise<ImportManufacturerRow> {
  const normalized: UpdateManufacturerRegistryInput = {
    enabled: input.enabled,
    auto_import: input.auto_import,
    website: input.website ?? input.website_url,
    category: input.category,
    brand: input.brand,
    logo_url: input.logo_url,
    description: input.description,
    country: input.country,
    import_strategy: input.import_strategy ?? (input.strategy_key as never),
    import_frequency: input.import_frequency,
  };

  const row = await updateManufacturerRegistry(id, normalized);
  return mapRegistryToLegacyRow(row);
}

export { recordManufacturerImportComplete };
