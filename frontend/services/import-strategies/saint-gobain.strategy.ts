import type { ImportLimits } from "@/services/import-limits";
import {
  isNavigationOrInformationalPage,
  type ManufacturerImportOptions,
} from "@/services/manufacturer-import.service";
import type {
  ManufacturerImportStrategy,
  StrategyBuildParams,
} from "@/services/import-strategies/types";

export const SAINT_GOBAIN_GLASS_BASE = "https://www.saint-gobain-glass.com";
export const SAINT_GOBAIN_GLASS_CATALOGUE_URL = `${SAINT_GOBAIN_GLASS_BASE}/en-gb/glass-products`;
export const SAINT_GOBAIN_GLASS_UK_BASE = "https://www.saint-gobain-glass.co.uk";

/** Verified catalogue entry points requested for the .com regional site. */
export const SAINT_GOBAIN_ENTRY_URLS = [
  `${SAINT_GOBAIN_GLASS_BASE}/en-gb/glass-products`,
  `${SAINT_GOBAIN_GLASS_BASE}/en-gb/products`,
] as const;

/**
 * Verified UK catalogue entry points (reachable without Cloudflare challenge).
 * Note: /glass-products redirects to a knowledge-centre article — do not use it.
 */
export const SAINT_GOBAIN_UK_ENTRY_URLS = [
  `${SAINT_GOBAIN_GLASS_UK_BASE}/our-glass-products/`,
  `${SAINT_GOBAIN_GLASS_UK_BASE}/products/our-product-range/`,
] as const;

const SAINT_GOBAIN_CATEGORY_SLUGS = new Set([
  "glass-products",
  "products",
  "product",
  "compare-glass",
  "knowledge-center",
  "glass-dealers-near-me",
  "mirror",
  "applications",
  "solutions",
  "resources",
  "news",
  "about",
  "contact",
]);

export function resolveSaintGobainWebsiteUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return SAINT_GOBAIN_GLASS_CATALOGUE_URL;
  }

  if (!parsed.hostname.includes("saint-gobain")) {
    return url.replace(/\/$/, "") || url;
  }

  if (parsed.hostname.includes("saint-gobain-glass.co.uk")) {
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length === 0) {
      return SAINT_GOBAIN_UK_ENTRY_URLS[0];
    }
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "") || parsed.origin;
  }

  // saint-gobain-glass.com is Cloudflare-protected (403 challenge) — crawl the UK mirror.
  return SAINT_GOBAIN_UK_ENTRY_URLS[0];
}

/** Crawl seeds — UK mirror only; .com entry points are Cloudflare-blocked. */
export function getSaintGobainEntryUrls(_websiteUrl: string): string[] {
  return [...SAINT_GOBAIN_UK_ENTRY_URLS];
}

/** Include globs must cover start URLs exactly — Apify skips non-matching seeds. */
export function buildSaintGobainIncludeGlobs(): string[] {
  return [
    `${SAINT_GOBAIN_GLASS_UK_BASE}/our-glass-products`,
    `${SAINT_GOBAIN_GLASS_UK_BASE}/our-glass-products/**`,
    `${SAINT_GOBAIN_GLASS_UK_BASE}/our-glassolutions-product-range/**`,
    `${SAINT_GOBAIN_GLASS_UK_BASE}/products`,
    `${SAINT_GOBAIN_GLASS_UK_BASE}/products/**`,
    `${SAINT_GOBAIN_GLASS_UK_BASE}/product/**`,
  ];
}

export function isSaintGobainProductPage(url: string): boolean {
  if (isNavigationOrInformationalPage(url)) return false;

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("saint-gobain")) return false;

    const segments = parsed.pathname.split("/").filter(Boolean).map((s) => s.toLowerCase());
    if (segments.length === 0) return false;

    const productIdx = segments.indexOf("product");
    if (productIdx >= 0) {
      const slug = segments[productIdx + 1];
      return Boolean(slug && !SAINT_GOBAIN_CATEGORY_SLUGS.has(slug));
    }

    const lastSlug = segments[segments.length - 1]!;
    if (SAINT_GOBAIN_CATEGORY_SLUGS.has(lastSlug)) {
      return false;
    }

    if (
      lastSlug.startsWith("sgg") ||
      lastSlug.startsWith("planitherm") ||
      lastSlug.includes("cool-lite") ||
      lastSlug.includes("cool_lite")
    ) {
      return true;
    }

    return segments.length >= 2 && !SAINT_GOBAIN_CATEGORY_SLUGS.has(segments[0]!);
  } catch {
    return false;
  }
}

export class SaintGobainStrategy implements ManufacturerImportStrategy {
  readonly id = "saint-gobain";
  readonly displayName = "Saint-Gobain";

  matches(manufacturer: string): boolean {
    const normalized = manufacturer.trim().toLowerCase();
    return (
      normalized === "saint-gobain" ||
      normalized === "saint gobain" ||
      normalized === "saint-gobain glass" ||
      normalized === "saint gobain glass"
    );
  }

  getImportLimits(): ImportLimits {
    return { maxPages: 25, limit: 30, timeout: 180_000 };
  }

  buildOptions(params: StrategyBuildParams): ManufacturerImportOptions {
    const limits = this.getImportLimits();
    const websiteUrl = resolveSaintGobainWebsiteUrl(
      params.websiteUrl || SAINT_GOBAIN_GLASS_BASE,
    );

    return {
      source: "saint-gobain-glass.com",
      manufacturer: params.manufacturer.trim(),
      websiteUrl,
      category: params.category || "Glass",
      productPageMatcher: isSaintGobainProductPage,
      includeUrlGlobs: buildSaintGobainIncludeGlobs(),
      entryUrls: getSaintGobainEntryUrls(websiteUrl),
      skipHomepageDiscovery: true,
      maxCrawlDepth: 3,
      // UK mirror serves product links in static HTML; cheerio avoids Playwright
      // navigation timeouts on Cloudflare-blocked .com redirects.
      crawlerType: "cheerio",
      maxPages: params.maxPages ?? limits.maxPages,
      limit: params.limit ?? limits.limit,
      timeoutMs: params.timeoutMs ?? limits.timeout,
      pollIntervalMs: params.pollIntervalMs ?? 5_000,
    };
  }
}

export const saintGobainStrategy = new SaintGobainStrategy();
