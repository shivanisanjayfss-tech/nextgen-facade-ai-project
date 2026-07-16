import { normalizeIdentityToken } from "@/lib/manufacturer-identity";
import type { ManufacturerRegistryRow } from "@/types/manufacturer-registry";

export interface NormalizedManufacturerIdentity {
  manufacturerId: string | null;
  canonicalName: string;
  brand: string | null;
  matchedAlias?: string;
}

/** In-memory alias index built from registry rows. */
export interface ManufacturerAliasIndex {
  byId: Map<string, ManufacturerRegistryRow>;
  byToken: Map<string, ManufacturerRegistryRow>;
}

export function buildManufacturerAliasIndex(
  rows: ManufacturerRegistryRow[],
): ManufacturerAliasIndex {
  const byId = new Map<string, ManufacturerRegistryRow>();
  const byToken = new Map<string, ManufacturerRegistryRow>();

  for (const row of rows) {
    byId.set(row.id, row);

    const tokens = new Set<string>([
      normalizeIdentityToken(row.name),
      normalizeIdentityToken(row.slug),
    ]);

    if (row.brand) {
      tokens.add(normalizeIdentityToken(row.brand));
    }

    if (row.website_host) {
      tokens.add(normalizeIdentityToken(row.website_host));
    }

    for (const alias of row.aliases ?? []) {
      if (alias.trim()) {
        tokens.add(normalizeIdentityToken(alias));
      }
    }

    for (const token of tokens) {
      if (token) {
        byToken.set(token, row);
      }
    }
  }

  return { byId, byToken };
}

export function resolveManufacturerFromIndex(
  index: ManufacturerAliasIndex,
  options: {
    manufacturerId?: string;
    rawName?: string;
    websiteHost?: string;
  },
): NormalizedManufacturerIdentity | null {
  if (options.manufacturerId) {
    const row = index.byId.get(options.manufacturerId);
    if (row) {
      return {
        manufacturerId: row.id,
        canonicalName: row.name,
        brand: row.brand,
      };
    }
  }

  if (options.websiteHost) {
    const byHost = index.byToken.get(normalizeIdentityToken(options.websiteHost));
    if (byHost) {
      return {
        manufacturerId: byHost.id,
        canonicalName: byHost.name,
        brand: byHost.brand,
      };
    }
  }

  if (options.rawName) {
    const token = normalizeIdentityToken(options.rawName);
    const row = index.byToken.get(token);
    if (row) {
      const matchedAlias =
        normalizeIdentityToken(row.name) === token ? undefined : options.rawName.trim();
      return {
        manufacturerId: row.id,
        canonicalName: row.name,
        brand: row.brand,
        matchedAlias,
      };
    }
  }

  return null;
}

/** Normalizes a raw import label to the canonical registry manufacturer name. */
export function normalizeManufacturerLabel(
  rawName: string,
  index: ManufacturerAliasIndex,
  websiteHost?: string,
): NormalizedManufacturerIdentity {
  const resolved = resolveManufacturerFromIndex(index, {
    rawName,
    websiteHost,
  });

  if (resolved) {
    return resolved;
  }

  return {
    manufacturerId: null,
    canonicalName: rawName.trim(),
    brand: null,
  };
}
