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

/** Reachable UK mirror used when .com is Cloudflare-protected. */
export const SAINT_GOBAIN_UK_ENTRY_URLS = [
  `${SAINT_GOBAIN_GLASS_UK_BASE}/glass-products`,
  `${SAINT_GOBAIN_GLASS_UK_BASE}/products`,
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
      return `${SAINT_GOBAIN_GLASS_UK_BASE}/glass-products`;
    }
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "") || parsed.origin;
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return SAINT_GOBAIN_GLASS_CATALOGUE_URL;
  }

  const hasProductPath = segments.some((segment) =>
    ["product", "products", "glass-products"].includes(segment.toLowerCase()),
  );

  if (!hasProductPath) {
    return SAINT_GOBAIN_GLASS_CATALOGUE_URL;
  }

  return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "") || parsed.origin;
}

/** Crawl seeds — .com URLs first (requested), plus UK mirror when .com is blocked. */
export function getSaintGobainEntryUrls(websiteUrl: string): string[] {
  const hostname = new URL(websiteUrl).hostname;

  if (hostname.includes("saint-gobain-glass.co.uk")) {
    return [...SAINT_GOBAIN_UK_ENTRY_URLS];
  }

  return [...SAINT_GOBAIN_ENTRY_URLS, ...SAINT_GOBAIN_UK_ENTRY_URLS];
}

/** Include globs must cover start URLs exactly — Apify skips non-matching seeds. */
export function buildSaintGobainIncludeGlobs(): string[] {
  return [
    `${SAINT_GOBAIN_GLASS_BASE}/en-gb/glass-products`,
    `${SAINT_GOBAIN_GLASS_BASE}/en-gb/glass-products/**`,
    `${SAINT_GOBAIN_GLASS_BASE}/en-gb/products`,
    `${SAINT_GOBAIN_GLASS_BASE}/en-gb/products/**`,
    `${SAINT_GOBAIN_GLASS_BASE}/en-gb/**`,
    `${SAINT_GOBAIN_GLASS_UK_BASE}/glass-products`,
    `${SAINT_GOBAIN_GLASS_UK_BASE}/glass-products/**`,
    `${SAINT_GOBAIN_GLASS_UK_BASE}/products`,
    `${SAINT_GOBAIN_GLASS_UK_BASE}/products/**`,
    `${SAINT_GOBAIN_GLASS_UK_BASE}/product/**`,
    `${SAINT_GOBAIN_GLASS_UK_BASE}/**`,
    "https://in.saint-gobain-glass.com/product/**",
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
      manufacturer: params.manufacturer.trim() || "Saint-Gobain",
      websiteUrl,
      category: params.category || "Glass",
      productPageMatcher: isSaintGobainProductPage,
      includeUrlGlobs: buildSaintGobainIncludeGlobs(),
      entryUrls: getSaintGobainEntryUrls(websiteUrl),
      skipHomepageDiscovery: true,
      maxCrawlDepth: 3,
      crawlerType: "playwright:adaptive",
      proxyGroups: ["RESIDENTIAL"],
      maxPages: params.maxPages ?? limits.maxPages,
      limit: params.limit ?? limits.limit,
      timeoutMs: params.timeoutMs ?? limits.timeout,
      pollIntervalMs: params.pollIntervalMs ?? 5_000,
    };
  }
}

export const saintGobainStrategy = new SaintGobainStrategy();
