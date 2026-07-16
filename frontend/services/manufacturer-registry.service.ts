import { getManufacturerCatalogueMatchNames, resolveCanonicalManufacturer } from "@/lib/manufacturer-catalog";
import {
  buildManufacturerAliasIndex,
  normalizeManufacturerLabel,
  resolveManufacturerFromIndex,
  type NormalizedManufacturerIdentity,
} from "@/lib/manufacturer-normalization";
import {
  findManufacturerIdByAlias,
  loadManufacturerAliasMap,
  syncManufacturerAliases,
} from "@/services/manufacturer-alias.service";
import {
  identityTokenMatchesRow,
  normalizeWebsiteHost,
} from "@/lib/manufacturer-identity";
import { manufacturerSlug } from "@/lib/manufacturer-slug";
import { computeNextMonthlyRun } from "@/lib/next-scheduled-run";
import {
  buildCreateManufacturerPayload,
  buildUpdateManufacturerPayload,
  validateManufacturerFormValues,
} from "@/lib/manufacturer-registry-defaults";
import { ServiceError } from "@/lib/errors";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { DB_TABLES } from "@/types/database";
import type { ScheduledManufacturer } from "@/types/import-scheduler";
import type {
  BuildImportQueueOptions,
  ManufacturerImportFrequency,
  ManufacturerImportStrategy,
  ManufacturerRegistryRow,
  ManufacturerRegistrySearchParams,
  CreateManufacturerRegistryInput,
  UpdateManufacturerRegistryInput,
} from "@/types/manufacturer-registry";

let useLegacyImportManufacturers = false;
const manufacturerIdCache = new Map<string, string | null>();

function isMissingManufacturersTable(message?: string): boolean {
  return Boolean(
    message?.includes("manufacturers") &&
      (message.includes("Could not find the table") ||
        message.includes("does not exist")),
  );
}

function isMissingManufacturerIdColumn(message?: string): boolean {
  return Boolean(
    message?.includes("manufacturer_id") && message.includes("does not exist"),
  );
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

function normalizeRegistryRow(
  row: Partial<ManufacturerRegistryRow> & { logo?: string | null },
): ManufacturerRegistryRow {
  const name = row.name ?? "";
  const website = row.website ?? "";
  return {
    id: row.id ?? "",
    name,
    brand: row.brand ?? null,
    category: row.category ?? "Other",
    website,
    website_host: row.website_host ?? (website ? normalizeWebsiteHost(website) : null),
    aliases: row.aliases ?? [],
    logo_url: row.logo_url ?? row.logo ?? null,
    country: row.country ?? null,
    headquarters: row.headquarters ?? null,
    description: row.description ?? null,
    enabled: row.enabled ?? false,
    auto_import: row.auto_import ?? true,
    import_frequency: (row.import_frequency ?? "monthly") as ManufacturerImportFrequency,
    import_strategy: (row.import_strategy ?? "generic") as ManufacturerImportStrategy,
    last_imported_at: row.last_imported_at ?? null,
    next_import_at: row.next_import_at ?? null,
    last_status: row.last_status ?? null,
    total_products: row.total_products ?? 0,
    slug: row.slug ?? (name ? manufacturerSlug(name) : ""),
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

function mapRowToScheduledManufacturer(
  row: ManufacturerRegistryRow,
): ScheduledManufacturer {
  return {
    id: row.id,
    manufacturer: row.name,
    brand: row.brand ?? undefined,
    url: row.website,
    category: row.category,
    importStrategy: row.import_strategy,
    slug: row.slug,
  };
}

function findRegistryRowByIdentity(
  rows: ManufacturerRegistryRow[],
  options: {
    manufacturerId?: string;
    name?: string;
    website?: string;
    slug?: string;
  },
): ManufacturerRegistryRow | null {
  if (options.manufacturerId) {
    const byId = rows.find((row) => row.id === options.manufacturerId);
    if (byId) return byId;
  }

  if (options.website) {
    const host = normalizeWebsiteHost(options.website);
    const byHost = rows.find((row) => row.website_host === host);
    if (byHost) return byHost;
  }

  if (options.slug) {
    const normalizedSlug = options.slug.trim().toLowerCase();
    const bySlug = rows.find(
      (row) =>
        row.slug === normalizedSlug ||
        manufacturerSlug(row.name) === normalizedSlug ||
        row.aliases.some((alias) => manufacturerSlug(alias) === normalizedSlug),
    );
    if (bySlug) return bySlug;
  }

  if (options.name) {
    const canonical = resolveCanonicalManufacturer(options.name);
    const byName = rows.find((row) =>
      identityTokenMatchesRow({
        token: options.name!,
        name: row.name,
        brand: row.brand,
        slug: row.slug,
        aliases: row.aliases,
      }) ||
      identityTokenMatchesRow({
        token: canonical,
        name: row.name,
        brand: row.brand,
        slug: row.slug,
        aliases: row.aliases,
      }),
    );
    if (byName) return byName;
  }

  return null;
}

function isInImportQueue(
  row: ManufacturerRegistryRow,
  options?: BuildImportQueueOptions,
): boolean {
  if (!row.enabled || !row.auto_import) return false;
  if (options?.frequency && row.import_frequency !== options.frequency) {
    return false;
  }
  return true;
}

async function attachAliasesToRows(
  rows: ManufacturerRegistryRow[],
): Promise<ManufacturerRegistryRow[]> {
  const aliasMap = await loadManufacturerAliasMap();
  if (aliasMap.size === 0) {
    return rows;
  }

  return rows.map((row) => ({
    ...row,
    aliases: aliasMap.get(row.id) ?? row.aliases ?? [],
  }));
}

function matchesRegistrySearch(
  row: ManufacturerRegistryRow,
  params: ManufacturerRegistrySearchParams,
): boolean {
  const q = params.q?.trim().toLowerCase();
  const category = params.category?.trim().toLowerCase();
  const country = params.country?.trim().toLowerCase();
  const website = params.website?.trim().toLowerCase();

  if (category && row.category.toLowerCase() !== category) {
    return false;
  }

  if (country && !(row.country ?? "").toLowerCase().includes(country)) {
    return false;
  }

  if (website && !row.website.toLowerCase().includes(website)) {
    return false;
  }

  if (q) {
    const haystack = [
      row.name,
      row.brand ?? "",
      ...(row.aliases ?? []),
      row.category,
      row.country ?? "",
      row.website,
      row.headquarters ?? "",
    ]
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(q)) {
      return false;
    }
  }

  return true;
}

async function loadRegistryRows(): Promise<ManufacturerRegistryRow[]> {
  if (!isSupabaseConfigured()) {
    console.warn(
      "[manufacturer-registry] Supabase is not configured — import queue is empty.",
    );
    return [];
  }

  if (useLegacyImportManufacturers) {
    return loadLegacyImportManufacturerRows();
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(DB_TABLES.manufacturers)
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    if (isMissingManufacturersTable(error.message)) {
      useLegacyImportManufacturers = true;
      console.warn(
        "[manufacturer-registry] Table missing — falling back to import_manufacturers until migration 014 is applied.",
      );
      return loadLegacyImportManufacturerRows();
    }

    console.error("[manufacturer-registry] Load failed:", error.message);
    return [];
  }

  const rows = (data ?? []).map((row) =>
    normalizeRegistryRow(row as Partial<ManufacturerRegistryRow>),
  );

  return attachAliasesToRows(rows);
}

/** Fallback for environments before migration 014. */
async function loadLegacyImportManufacturerRows(): Promise<ManufacturerRegistryRow[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(DB_TABLES.importManufacturers)
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[manufacturer-registry] Legacy load failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const legacy = row as {
      id: string;
      manufacturer: string;
      brand: string | null;
      website_url: string;
      category: string;
      enabled: boolean;
      auto_import?: boolean;
      strategy_key?: string;
      logo_url?: string | null;
      description?: string | null;
      country?: string | null;
      slug?: string | null;
      created_at: string;
      updated_at: string;
    };

    return normalizeRegistryRow({
      id: legacy.id,
      name: legacy.manufacturer,
      brand: legacy.brand,
      category: legacy.category,
      website: legacy.website_url,
      logo_url: legacy.logo_url ?? null,
      country: legacy.country ?? null,
      description: legacy.description ?? null,
      enabled: legacy.enabled,
      auto_import: legacy.auto_import ?? true,
      import_frequency: "monthly",
      import_strategy: (legacy.strategy_key ?? "generic") as ManufacturerImportStrategy,
      slug: legacy.slug ?? manufacturerSlug(legacy.manufacturer),
      created_at: legacy.created_at,
      updated_at: legacy.updated_at,
    });
  });
}

async function countProductsForManufacturer(
  manufacturerId: string,
  manufacturerName: string,
): Promise<number | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = requireSupabase();
  const { count: byIdCount, error: byIdError } = await supabase
    .from(DB_TABLES.materials)
    .select("*", { count: "exact", head: true })
    .eq("manufacturer_id", manufacturerId);

  if (!byIdError && byIdCount !== null) {
    return byIdCount;
  }

  if (byIdError && !isMissingManufacturerIdColumn(byIdError.message)) {
    console.error(
      "[manufacturer-registry] Product count by id failed:",
      byIdError.message,
    );
  }

  const matchNames = getManufacturerCatalogueMatchNames(manufacturerName);
  const { count, error } = await supabase
    .from(DB_TABLES.materials)
    .select("*", { count: "exact", head: true })
    .in("manufacturer", matchNames);

  if (error) {
    console.error("[manufacturer-registry] Product count by name failed:", error.message);
    return null;
  }

  return count ?? 0;
}

/** Builds the scheduler import queue from the manufacturer registry. */
export async function buildManufacturerImportQueue(
  options?: BuildImportQueueOptions,
): Promise<ScheduledManufacturer[]> {
  const rows = await loadRegistryRows();
  return rows.filter((row) => isInImportQueue(row, options)).map(mapRowToScheduledManufacturer);
}

/** Returns all registry rows for admin display. */
export async function listManufacturerRegistry(): Promise<ManufacturerRegistryRow[]> {
  return loadRegistryRows();
}

/** Filters registry rows by name, category, country, and website. */
export async function searchManufacturerRegistry(
  params: ManufacturerRegistrySearchParams = {},
): Promise<ManufacturerRegistryRow[]> {
  const rows = await loadRegistryRows();
  return rows.filter((row) => matchesRegistrySearch(row, params));
}

/** Counts manufacturers eligible for automatic import. */
export async function countManufacturerImportQueue(
  options?: BuildImportQueueOptions,
): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  if (useLegacyImportManufacturers) {
    const rows = await loadLegacyImportManufacturerRows();
    return rows.filter((row) => isInImportQueue(row, options)).length;
  }

  const supabase = requireSupabase();
  let query = supabase
    .from(DB_TABLES.manufacturers)
    .select("*", { count: "exact", head: true })
    .eq("enabled", true)
    .eq("auto_import", true);

  if (options?.frequency) {
    query = query.eq("import_frequency", options.frequency);
  }

  const { count, error } = await query;

  if (error) {
    if (isMissingManufacturersTable(error.message)) {
      useLegacyImportManufacturers = true;
      return countManufacturerImportQueue();
    }

    console.error("[manufacturer-registry] Count failed:", error.message);
    return 0;
  }

  return count ?? 0;
}

/** Finds a registry row by URL slug, alias slug, or company name slug. */
export async function getManufacturerRegistryBySlug(
  slug: string,
): Promise<ManufacturerRegistryRow | null> {
  const rows = await loadRegistryRows();
  return findRegistryRowByIdentity(rows, { slug });
}

/** Finds a registry row by primary key. */
export async function getManufacturerRegistryById(
  id: string,
): Promise<ManufacturerRegistryRow | null> {
  const rows = await loadRegistryRows();
  return rows.find((row) => row.id === id) ?? null;
}

/** Resolves a registry row using manufacturer_id first, then website or aliases. */
export async function resolveManufacturerRegistryRow(options: {
  manufacturerId?: string;
  name?: string;
  website?: string;
}): Promise<ManufacturerRegistryRow | null> {
  const rows = await loadRegistryRows();
  return findRegistryRowByIdentity(rows, options);
}

/** Resolves a registry manufacturer id — prefers explicit manufacturer_id. */
export async function resolveManufacturerId(options: {
  manufacturerId?: string;
  name?: string;
  website?: string;
}): Promise<string | null> {
  if (options.manufacturerId) {
    return options.manufacturerId;
  }

  const cacheKey = [
    options.name?.trim().toLowerCase() ?? "",
    options.website ? normalizeWebsiteHost(options.website) : "",
  ].join("::");

  if (cacheKey && manufacturerIdCache.has(cacheKey)) {
    return manufacturerIdCache.get(cacheKey) ?? null;
  }

  const match = await resolveManufacturerRegistryRow(options);
  const id = match?.id ?? null;

  if (cacheKey) {
    manufacturerIdCache.set(cacheKey, id);
  }

  return id;
}

/** Resolves a registry manufacturer id from a product manufacturer name. */
export async function resolveManufacturerIdByName(
  manufacturerName: string,
  website?: string | null,
): Promise<string | null> {
  return resolveManufacturerId({ name: manufacturerName, website: website ?? undefined });
}

/** Clears the in-memory manufacturer id lookup cache. */
export function clearManufacturerIdCache(): void {
  manufacturerIdCache.clear();
}

/**
 * Normalizes a raw manufacturer label to the canonical registry identity.
 * Used during imports to prevent duplicate manufacturers and enforce manufacturer_id.
 */
export async function normalizeManufacturerForImport(options: {
  rawName: string;
  website?: string;
  manufacturerId?: string;
}): Promise<NormalizedManufacturerIdentity> {
  const rows = await loadRegistryRows();
  const index = buildManufacturerAliasIndex(rows);
  const websiteHost = options.website ? normalizeWebsiteHost(options.website) : undefined;

  const resolved = resolveManufacturerFromIndex(index, {
    manufacturerId: options.manufacturerId,
    rawName: options.rawName,
    websiteHost,
  });

  if (resolved) {
    return resolved;
  }

  return normalizeManufacturerLabel(options.rawName, index, websiteHost);
}

/** Updates manufacturer registry configuration. */
export async function updateManufacturerRegistry(
  id: string,
  input: UpdateManufacturerRegistryInput,
): Promise<ManufacturerRegistryRow> {
  if (!isSupabaseConfigured()) {
    throw new ServiceError(
      "Supabase is not configured.",
      "SUPABASE_NOT_CONFIGURED",
      503,
    );
  }

  const payload = buildUpdateManufacturerPayload(input);

  if (useLegacyImportManufacturers) {
    return updateLegacyImportManufacturer(id, payload);
  }

  const supabase = requireSupabase();
  const updatePayload = {
    ...payload,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(DB_TABLES.manufacturers)
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (isMissingManufacturersTable(error.message)) {
      useLegacyImportManufacturers = true;
      return updateLegacyImportManufacturer(id, payload);
    }

    throw new ServiceError(
      `Failed to update manufacturer: ${error.message}`,
      "MANUFACTURER_REGISTRY_UPDATE_FAILED",
      500,
    );
  }

  if (input.aliases !== undefined) {
    await syncManufacturerAliases(id, input.aliases, payload.name);
  }

  manufacturerIdCache.clear();
  const normalized = normalizeRegistryRow(data as Partial<ManufacturerRegistryRow>);
  const aliasMap = await loadManufacturerAliasMap();
  return {
    ...normalized,
    aliases: aliasMap.get(id) ?? normalized.aliases,
  };
}

/** Creates a manufacturer registry row for automatic monthly import. */
export async function createManufacturerRegistry(
  input: CreateManufacturerRegistryInput,
): Promise<ManufacturerRegistryRow> {
  if (!isSupabaseConfigured()) {
    throw new ServiceError(
      "Supabase is not configured.",
      "SUPABASE_NOT_CONFIGURED",
      503,
    );
  }

  const validationError = validateManufacturerFormValues({
    name: input.name,
    website: input.website,
    category: input.category,
  });

  if (validationError) {
    throw new ServiceError(validationError, "MANUFACTURER_REGISTRY_INVALID", 400);
  }

  const existingRows = await loadRegistryRows();

  const normalizedIdentity = await normalizeManufacturerForImport({
    rawName: input.name,
    website: input.website,
  });

  if (normalizedIdentity.manufacturerId) {
    const existing =
      existingRows.find((row) => row.id === normalizedIdentity.manufacturerId) ?? null;
    throw new ServiceError(
      `Manufacturer already exists as "${existing?.name ?? normalizedIdentity.canonicalName}". Use aliases on the existing record instead of creating a duplicate.`,
      "MANUFACTURER_REGISTRY_DUPLICATE",
      409,
    );
  }

  for (const alias of input.aliases ?? []) {
    const ownerId = await findManufacturerIdByAlias(alias);
    if (ownerId) {
      const owner = existingRows.find((row) => row.id === ownerId);
      throw new ServiceError(
        `Alias "${alias.trim()}" already belongs to "${owner?.name ?? "another manufacturer"}".`,
        "MANUFACTURER_REGISTRY_DUPLICATE",
        409,
      );
    }
  }

  const duplicate = findRegistryRowByIdentity(existingRows, {
    name: input.name,
    website: input.website,
  });

  if (duplicate) {
    throw new ServiceError(
      `Manufacturer already exists as "${duplicate.name}". Use aliases on the existing record instead of creating a duplicate.`,
      "MANUFACTURER_REGISTRY_DUPLICATE",
      409,
    );
  }

  if (useLegacyImportManufacturers) {
    return createLegacyImportManufacturer(input);
  }

  const supabase = requireSupabase();
  const payload = buildCreateManufacturerPayload(input);

  const { data, error } = await supabase
    .from(DB_TABLES.manufacturers)
    .insert(payload)
    .select()
    .single();

  if (error) {
    if (isMissingManufacturersTable(error.message)) {
      useLegacyImportManufacturers = true;
      return createLegacyImportManufacturer(input);
    }

    if (error.code === "23505" || /duplicate key/i.test(error.message)) {
      const host = payload.website_host as string | undefined;
      throw new ServiceError(
        host
          ? `A manufacturer with website "${host}" already exists.`
          : "A manufacturer with this identity already exists.",
        "MANUFACTURER_REGISTRY_DUPLICATE",
        409,
      );
    }

    throw new ServiceError(
      `Failed to create manufacturer: ${error.message}`,
      "MANUFACTURER_REGISTRY_CREATE_FAILED",
      500,
    );
  }

  manufacturerIdCache.clear();
  const normalized = normalizeRegistryRow(data as Partial<ManufacturerRegistryRow>);
  const aliases = await syncManufacturerAliases(
    normalized.id,
    input.aliases ?? [],
    normalized.name,
  );

  return {
    ...normalized,
    aliases,
  };
}

async function createLegacyImportManufacturer(
  input: CreateManufacturerRegistryInput,
): Promise<ManufacturerRegistryRow> {
  const supabase = requireSupabase();
  const payload = buildCreateManufacturerPayload(input);
  const legacyPayload = {
    manufacturer: payload.name as string,
    brand: payload.brand as string | null,
    website_url: payload.website as string,
    category: payload.category as string,
    enabled: payload.enabled as boolean,
    auto_import: payload.auto_import as boolean,
    strategy_key: payload.import_strategy as string,
    slug: payload.slug as string,
    logo_url: payload.logo_url as string | null,
    description: payload.description as string | null,
    country: payload.country as string | null,
    sort_order: 0,
    created_at: payload.created_at as string,
    updated_at: payload.updated_at as string,
  };

  const { data, error } = await supabase
    .from(DB_TABLES.importManufacturers)
    .insert(legacyPayload)
    .select()
    .single();

  if (error) {
    if (error.code === "23505" || /duplicate key/i.test(error.message)) {
      throw new ServiceError(
        "A manufacturer with this name already exists.",
        "MANUFACTURER_REGISTRY_DUPLICATE",
        409,
      );
    }

    throw new ServiceError(
      `Failed to create manufacturer: ${error.message}`,
      "MANUFACTURER_REGISTRY_CREATE_FAILED",
      500,
    );
  }

  const rows = await loadLegacyImportManufacturerRows();
  const created = rows.find((row) => row.id === (data as { id: string }).id);
  return created ?? normalizeRegistryRow({
    id: (data as { id: string }).id,
    name: legacyPayload.manufacturer,
    brand: legacyPayload.brand,
    category: legacyPayload.category,
    website: legacyPayload.website_url,
    enabled: legacyPayload.enabled,
    auto_import: legacyPayload.auto_import,
    import_strategy: legacyPayload.strategy_key as ManufacturerImportStrategy,
    slug: legacyPayload.slug,
  });
}

async function updateLegacyImportManufacturer(
  id: string,
  input: UpdateManufacturerRegistryInput,
): Promise<ManufacturerRegistryRow> {
  const supabase = requireSupabase();
  const legacyPayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.enabled !== undefined) legacyPayload.enabled = input.enabled;
  if (input.auto_import !== undefined) legacyPayload.auto_import = input.auto_import;
  if (input.name !== undefined) legacyPayload.manufacturer = input.name;
  if (input.website !== undefined) legacyPayload.website_url = input.website;
  if (input.category !== undefined) legacyPayload.category = input.category;
  if (input.brand !== undefined) legacyPayload.brand = input.brand;
  if (input.logo_url !== undefined) legacyPayload.logo_url = input.logo_url;
  if (input.description !== undefined) legacyPayload.description = input.description;
  if (input.country !== undefined) legacyPayload.country = input.country;
  if (input.import_strategy !== undefined) {
    legacyPayload.strategy_key = input.import_strategy;
  }

  const { data, error } = await supabase
    .from(DB_TABLES.importManufacturers)
    .update(legacyPayload)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new ServiceError(
      `Failed to update manufacturer: ${error?.message ?? "unknown error"}`,
      "MANUFACTURER_REGISTRY_UPDATE_FAILED",
      500,
    );
  }

  const rows = await loadLegacyImportManufacturerRows();
  return rows.find((row) => row.id === id) ?? normalizeRegistryRow({});
}

/** Records a completed import against the registry. */
export async function recordManufacturerImportComplete(
  manufacturerId: string,
  options?: { productCount?: number; status?: string },
): Promise<void> {
  if (!isSupabaseConfigured() || useLegacyImportManufacturers) return;

  const supabase = requireSupabase();
  const row = await getManufacturerRegistryById(manufacturerId);
  if (!row) return;

  const now = new Date();
  const nextImportAt = computeNextMonthlyRun(now);

  const payload: Record<string, unknown> = {
    last_imported_at: now.toISOString(),
    next_import_at: nextImportAt.toISOString(),
    updated_at: now.toISOString(),
  };

  if (options?.status) {
    payload.last_status = options.status;
  }

  if (typeof options?.productCount === "number") {
    payload.total_products = options.productCount;
  } else {
    const syncedCount = await countProductsForManufacturer(manufacturerId, row.name);
    if (syncedCount !== null) {
      payload.total_products = syncedCount;
    }
  }

  const { error } = await supabase
    .from(DB_TABLES.manufacturers)
    .update(payload)
    .eq("id", manufacturerId);

  if (error && isMissingManufacturersTable(error.message)) {
    useLegacyImportManufacturers = true;
    return;
  }

  if (error) {
    console.error(
      "[manufacturer-registry] Failed to record import completion:",
      error.message,
    );
  }
}

/** Maps a registry row to a scheduler entry for single-manufacturer imports. */
export function mapRegistryRowToScheduledManufacturer(
  row: ManufacturerRegistryRow,
): ScheduledManufacturer {
  return mapRowToScheduledManufacturer(row);
}
