import type { ImportLimits } from "@/services/import-limits";
import {
  isNavigationOrInformationalPage,
  NAVIGATION_PATH_SLUGS,
  type ManufacturerImportOptions,
} from "@/services/manufacturer-import.service";
import type {
  ManufacturerImportStrategy,
  StrategyBuildParams,
} from "@/services/import-strategies/types";

export const GUARDIAN_GLASS_BASE = "https://www.guardianglass.com";
export const GUARDIAN_GLASS_CATALOGUE_URL = `${GUARDIAN_GLASS_BASE}/us/en/our-glass`;

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

const GUARDIAN_RANGE_HUB_SLUGS = new Set(["sunguard", "bird1st"]);

const GUARDIAN_ENTRY_URLS = [
  GUARDIAN_GLASS_CATALOGUE_URL,
  `${GUARDIAN_GLASS_CATALOGUE_URL}/solar-control-glass`,
  `${GUARDIAN_GLASS_CATALOGUE_URL}/float-glass`,
];

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

export class GuardianGlassStrategy implements ManufacturerImportStrategy {
  readonly id = "guardian-glass";
  readonly displayName = "Guardian Glass";

  matches(manufacturer: string): boolean {
    return manufacturer.trim().toLowerCase() === "guardian glass";
  }

  getImportLimits(): ImportLimits {
    return { maxPages: 25, limit: 30, timeout: 45_000 };
  }

  buildOptions(params: StrategyBuildParams): ManufacturerImportOptions {
    const limits = this.getImportLimits();
    const websiteUrl = resolveGuardianGlassWebsiteUrl(
      params.websiteUrl || GUARDIAN_GLASS_BASE,
    );

    return {
      source: "guardianglass.com",
      manufacturer: "Guardian Glass",
      websiteUrl,
      category: params.category || "Glass",
      productPageMatcher: isGuardianGlassProductPage,
      includeUrlGlobs: [`${GUARDIAN_GLASS_BASE}/us/en/our-glass/**`],
      entryUrls: [...GUARDIAN_ENTRY_URLS],
      skipHomepageDiscovery: true,
      maxCrawlDepth: 3,
      earlyExitProductCount: 12,
      maxPages: params.maxPages ?? limits.maxPages,
      limit: params.limit ?? limits.limit,
      timeoutMs: params.timeoutMs ?? limits.timeout,
      pollIntervalMs: params.pollIntervalMs ?? 2_000,
    };
  }
}

export const guardianGlassStrategy = new GuardianGlassStrategy();
