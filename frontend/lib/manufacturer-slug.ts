import { normalizeIdentityToken } from "@/lib/manufacturer-identity";

/** URL-safe slug derived from a manufacturer display name. */
export function manufacturerSlug(name: string): string {
  return normalizeIdentityToken(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Returns true when a slug matches a manufacturer display name. */
export function manufacturerSlugMatches(name: string, slug: string): boolean {
  return manufacturerSlug(name) === slug.trim().toLowerCase();
}
