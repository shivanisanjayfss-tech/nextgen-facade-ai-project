import type { ManufacturerImportOptions } from "@/services/manufacturer-import.service";
import {
  importManufacturerProducts,
  NAVIGATION_PATH_SLUGS,
} from "@/services/manufacturer-import.service";

export const GUARDIAN_GLASS_BASE = "https://www.guardianglass.com";
export const GUARDIAN_GLASS_CATALOGUE_URL = `${GUARDIAN_GLASS_BASE}/us/en/our-glass`;

/** Category hub slugs under /our-glass/ — not individual product pages. */
const GUARDIAN_CATEGORY_SLUGS = new Set([
  "solar-control-glass",
  "glass-for-interiors",
  "float-glass",
  "climaguard",
  "automotive-glass",
  "glass-for-appliances",
  "mirrored-glass",
  "decorative-and-etched-glass",
  "glass-for-bird-friendly-design",
  "glass-types",
  "digital-glass-selector",
]);

/** Product family hubs that list ranges rather than a single product. */
const GUARDIAN_RANGE_HUB_SLUGS = new Set(["sunguard", "bird1st"]);

/** Known catalogue entry points on the US regional site. */
const GUARDIAN_ENTRY_URLS = [
  GUARDIAN_GLASS_CATALOGUE_URL,
  `${GUARDIAN_GLASS_CATALOGUE_URL}/solar-control-glass`,
  `${GUARDIAN_GLASS_CATALOGUE_URL}/glass-for-interiors`,
  `${GUARDIAN_GLASS_CATALOGUE_URL}/float-glass`,
  `${GUARDIAN_GLASS_CATALOGUE_URL}/climaguard`,
  `${GUARDIAN_GLASS_CATALOGUE_URL}/automotive-glass`,
  `${GUARDIAN_GLASS_CATALOGUE_URL}/glass-for-appliances`,
  `${GUARDIAN_GLASS_CATALOGUE_URL}/mirrored-glass`,
  `${GUARDIAN_GLASS_CATALOGUE_URL}/decorative-and-etched-glass`,
  `${GUARDIAN_GLASS_CATALOGUE_URL}/glass-for-bird-friendly-design`,
  `${GUARDIAN_GLASS_CATALOGUE_URL}/glass-types`,
];

export interface GuardianGlassImportOptions {
  websiteUrl?: string;
  category?: string;
  maxPages?: number;
  limit?: number;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export function isGuardianGlassManufacturer(manufacturer: string): boolean {
  return manufacturer.trim().toLowerCase() === "guardian glass";
}

/**
 * Guardian's root domain is a country selector. Product catalogues live under
 * regional paths such as /us/en/our-glass/.
 */
export function resolveGuardianGlassWebsiteUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return GUARDIAN_GLASS_CATALOGUE_URL;
  }

  if (!parsed.hostname.includes("guardianglass.com")) {
    return url.replace(/\/$/, "") || url;
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return GUARDIAN_GLASS_CATALOGUE_URL;
  }

  const ourGlassIdx = segments.indexOf("our-glass");
  if (ourGlassIdx < 0) {
    return GUARDIAN_GLASS_CATALOGUE_URL;
  }

  return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "") || parsed.origin;
}

/** Returns predefined US catalogue entry URLs — not homepage link discovery. */
export function getGuardianGlassEntryUrls(): string[] {
  return [...GUARDIAN_ENTRY_URLS];
}

/**
 * Guardian product pages use /us/en/our-glass/ with either:
 * - a flat product slug (e.g. /our-glass/sunguard-snx-62-27)
 * - a category + product path (e.g. /our-glass/glass-for-interiors/showerguard)
 * - a family + variant path (e.g. /our-glass/sunguard-snx-60/snx-60-plus-on-clear)
 */
export function isGuardianGlassProductPage(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("guardianglass.com")) return false;

    const segments = parsed.pathname.split("/").filter(Boolean);
    const ourGlassIdx = segments.indexOf("our-glass");
    if (ourGlassIdx < 0) return false;

    const afterOurGlass = segments.slice(ourGlassIdx + 1);
    if (afterOurGlass.length === 0) return false;

    const lowerSegments = afterOurGlass.map((segment) => segment.toLowerCase());

    if (
      lowerSegments.some(
        (segment) =>
          NAVIGATION_PATH_SLUGS.has(segment) || GUARDIAN_RANGE_HUB_SLUGS.has(segment),
      )
    ) {
      return false;
    }

    const lastSlug = lowerSegments[lowerSegments.length - 1]!;
    if (GUARDIAN_CATEGORY_SLUGS.has(lastSlug)) {
      return false;
    }

    if (lowerSegments.length === 1) {
      return (
        !GUARDIAN_CATEGORY_SLUGS.has(lowerSegments[0]!) &&
        !GUARDIAN_RANGE_HUB_SLUGS.has(lowerSegments[0]!)
      );
    }

    const firstSlug = lowerSegments[0]!;
    if (GUARDIAN_CATEGORY_SLUGS.has(firstSlug)) {
      return lowerSegments.length >= 2;
    }

    return true;
  } catch {
    return false;
  }
}

export function buildGuardianGlassImportOptions(
  params: GuardianGlassImportOptions = {},
): ManufacturerImportOptions {
  const websiteUrl = resolveGuardianGlassWebsiteUrl(
    params.websiteUrl ?? GUARDIAN_GLASS_BASE,
  );

  return {
    source: "guardianglass.com",
    manufacturer: "Guardian Glass",
    websiteUrl,
    category: params.category ?? "Glass",
    productPageMatcher: isGuardianGlassProductPage,
    includeUrlGlobs: [`${GUARDIAN_GLASS_BASE}/us/en/our-glass/**`],
    entryUrls: getGuardianGlassEntryUrls(),
    skipHomepageDiscovery: true,
    maxCrawlDepth: 4,
    maxPages: params.maxPages,
    limit: params.limit,
    timeoutMs: params.timeoutMs,
    pollIntervalMs: params.pollIntervalMs,
  };
}

/** Guardian Glass-specific import config — delegates to the generic manufacturer importer. */
export async function importGuardianGlassProducts(
  options: GuardianGlassImportOptions = {},
): Promise<ReturnType<typeof importManufacturerProducts>> {
  return importManufacturerProducts(buildGuardianGlassImportOptions(options));
}
