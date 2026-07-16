/**
 * Normalizes a manufacturer website to a stable hostname identity key.
 * Used for deduplication and registry matching.
 */
export function normalizeWebsiteHost(website: string): string {
  const trimmed = website.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .toLowerCase();
  }
}

export function normalizeIdentityToken(value: string): string {
  return value.trim().toLowerCase();
}

/** Returns true when a label matches a registry name, alias, brand, or slug token. */
export function identityTokenMatchesRow(options: {
  token: string;
  name: string;
  brand?: string | null;
  slug?: string;
  aliases?: string[] | null;
}): boolean {
  const token = normalizeIdentityToken(options.token);
  if (!token) return false;

  const candidates = new Set<string>([normalizeIdentityToken(options.name)]);

  if (options.brand) {
    candidates.add(normalizeIdentityToken(options.brand));
  }

  if (options.slug) {
    candidates.add(normalizeIdentityToken(options.slug));
  }

  for (const alias of options.aliases ?? []) {
    if (alias?.trim()) {
      candidates.add(normalizeIdentityToken(alias));
    }
  }

  return candidates.has(token);
}

export function parseAliasesInput(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((alias) => alias.trim())
        .filter(Boolean),
    ),
  );
}

export function formatAliasesForInput(aliases?: string[] | null): string {
  return (aliases ?? []).join(", ");
}

export function mergeAliasList(
  existing: string[] | null | undefined,
  additions: string[],
): string[] {
  return Array.from(
    new Set([...(existing ?? []), ...additions.map((alias) => alias.trim()).filter(Boolean)]),
  );
}

/** Stable grouping key — prefers manufacturer_id over free-text labels. */
export function manufacturerIdentityKey(options: {
  manufacturerId?: string | null;
  manufacturer?: string | null;
}): string {
  if (options.manufacturerId?.trim()) {
    return options.manufacturerId.trim();
  }

  return (options.manufacturer ?? "").trim().toLowerCase();
}
