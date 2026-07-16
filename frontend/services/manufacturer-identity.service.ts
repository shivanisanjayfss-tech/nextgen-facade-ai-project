import { normalizeWebsiteHost } from "@/lib/manufacturer-identity";
import {
  buildManufacturerAliasIndex,
  resolveManufacturerFromIndex,
  type ManufacturerAliasIndex,
  type NormalizedManufacturerIdentity,
} from "@/lib/manufacturer-normalization";
import { listManufacturerRegistry } from "@/services/manufacturer-registry.service";
import type { PersistCrawledProductsOptions } from "@/types/import";
import type { ManufacturerRegistryRow } from "@/types/manufacturer-registry";

export type ManufacturerIdentity = NormalizedManufacturerIdentity;

export interface ResolveManufacturerIdentityInput {
  manufacturerId?: string | null;
  rawName?: string | null;
  website?: string | null;
  sourceUrl?: string | null;
}

const CACHE_TTL_MS = 60_000;

let cachedIndex: ManufacturerAliasIndex | null = null;
let cacheLoadedAt = 0;

function resolveWebsiteHost(input: ResolveManufacturerIdentityInput): string | undefined {
  const website = input.website?.trim() || input.sourceUrl?.trim();
  if (!website) return undefined;
  return normalizeWebsiteHost(website);
}

/** Clears the in-memory manufacturer identity index cache. */
export function invalidateManufacturerIdentityCache(): void {
  cachedIndex = null;
  cacheLoadedAt = 0;
}

/** Loads registry rows and builds the alias index used by identity resolution. */
export async function getManufacturerIdentityIndex(): Promise<ManufacturerAliasIndex> {
  const now = Date.now();
  if (cachedIndex && now - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedIndex;
  }

  const rows = await listManufacturerRegistry();
  cachedIndex = buildManufacturerAliasIndex(rows);
  cacheLoadedAt = now;
  return cachedIndex;
}

/**
 * Resolves any manufacturer label, alias, website host, or id to a single
 * canonical registry identity. Alias text is never returned as canonicalName.
 */
export function resolveManufacturerIdentityFromIndex(
  index: ManufacturerAliasIndex,
  input: ResolveManufacturerIdentityInput,
): ManufacturerIdentity {
  const manufacturerId = input.manufacturerId?.trim() || undefined;
  const rawName = input.rawName?.trim() || undefined;
  const websiteHost = resolveWebsiteHost(input);

  const resolved = resolveManufacturerFromIndex(index, {
    manufacturerId,
    rawName,
    websiteHost,
  });

  if (resolved) {
    return resolved;
  }

  return {
    manufacturerId: null,
    canonicalName: rawName ?? "",
    brand: null,
  };
}

/** Async identity resolution backed by the registry and manufacturer_aliases table. */
export async function resolveManufacturerIdentity(
  input: ResolveManufacturerIdentityInput,
): Promise<ManufacturerIdentity> {
  const index = await getManufacturerIdentityIndex();
  return resolveManufacturerIdentityFromIndex(index, input);
}

/** Builds the shared persist context used by manual and scheduled imports. */
export function buildImportPersistContextFromRegistry(
  row: Pick<ManufacturerRegistryRow, "id" | "name" | "brand">,
): PersistCrawledProductsOptions {
  return {
    manufacturerId: row.id,
    registryName: row.name,
    registryBrand: row.brand ?? null,
  };
}

/** Resolves registry context for a manual import request. */
export async function resolveImportPersistContext(options: {
  manufacturer?: string;
  manufacturerId?: string;
  websiteUrl: string;
}): Promise<PersistCrawledProductsOptions | undefined> {
  const identity = await resolveManufacturerIdentity({
    manufacturerId: options.manufacturerId,
    rawName: options.manufacturer,
    website: options.websiteUrl,
  });

  if (!identity.manufacturerId) {
    return undefined;
  }

  return {
    manufacturerId: identity.manufacturerId,
    registryName: identity.canonicalName,
    registryBrand: identity.brand,
  };
}

export { manufacturerIdentityKey } from "@/lib/manufacturer-identity";
