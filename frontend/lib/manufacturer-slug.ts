import { manufacturerCatalogueKey } from "@/lib/manufacturer-catalog";

/** URL-safe slug derived from a manufacturer display name. */
export function manufacturerSlug(name: string): string {
  return manufacturerCatalogueKey(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Returns true when a slug matches a manufacturer display name. */
export function manufacturerSlugMatches(name: string, slug: string): boolean {
  return manufacturerSlug(name) === slug.trim().toLowerCase();
}
