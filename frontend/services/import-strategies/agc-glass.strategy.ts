import type { ImportLimits } from "@/services/import-limits";
import {
  isNavigationOrInformationalPage,
  type ManufacturerImportOptions,
} from "@/services/manufacturer-import.service";
import type {
  ManufacturerImportStrategy,
  StrategyBuildParams,
} from "@/services/import-strategies/types";

export const AGC_GLASS_BASE = "https://www.agc-yourglass.com";
export const AGC_GLASS_CATALOGUE_URL = `${AGC_GLASS_BASE}/en/products`;

const AGC_CATEGORY_SLUGS = new Set([
  "products",
  "product",
  "glass",
  "applications",
  "solutions",
  "resources",
  "news",
  "about",
  "contact",
  "tools",
]);

const AGC_ENTRY_URLS = [
  AGC_GLASS_CATALOGUE_URL,
  `${AGC_GLASS_BASE}/en/products/`,
  `${AGC_GLASS_BASE}/en/glass/`,
] as const;

export function isAgcGlassProductPage(url: string): boolean {
  if (isNavigationOrInformationalPage(url)) return false;

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("agc-yourglass.com")) return false;

    const segments = parsed.pathname.split("/").filter(Boolean).map((s) => s.toLowerCase());
    if (segments.length < 3) return false;

    const productsIdx = segments.indexOf("products");
    if (productsIdx >= 0) {
      const slug = segments[productsIdx + 1];
      return Boolean(slug && !AGC_CATEGORY_SLUGS.has(slug) && segments.length > productsIdx + 1);
    }

    const glassIdx = segments.indexOf("glass");
    if (glassIdx >= 0) {
      const slug = segments[glassIdx + 1];
      return Boolean(slug && !AGC_CATEGORY_SLUGS.has(slug));
    }

    const lastSlug = segments[segments.length - 1]!;
    return !AGC_CATEGORY_SLUGS.has(lastSlug) && segments.length >= 3;
  } catch {
    return false;
  }
}

export class AgcGlassStrategy implements ManufacturerImportStrategy {
  readonly id = "agc-glass";
  readonly displayName = "AGC Glass";

  matches(manufacturer: string): boolean {
    const normalized = manufacturer.trim().toLowerCase();
    return normalized === "agc glass" || normalized === "agc";
  }

  getImportLimits(): ImportLimits {
    return { maxPages: 25, limit: 30, timeout: 120_000 };
  }

  buildOptions(params: StrategyBuildParams): ManufacturerImportOptions {
    const limits = this.getImportLimits();

    return {
      source: "agc-yourglass.com",
      manufacturer: "AGC Glass",
      websiteUrl: params.websiteUrl || AGC_GLASS_CATALOGUE_URL,
      category: params.category || "Glass",
      productPageMatcher: isAgcGlassProductPage,
      includeUrlGlobs: [
        `${AGC_GLASS_BASE}/en/products/**`,
        `${AGC_GLASS_BASE}/en/glass/**`,
      ],
      entryUrls: [...AGC_ENTRY_URLS],
      skipHomepageDiscovery: true,
      maxCrawlDepth: 3,
      crawlerType: "cheerio",
      maxPages: params.maxPages ?? limits.maxPages,
      limit: params.limit ?? limits.limit,
      timeoutMs: params.timeoutMs ?? limits.timeout,
      pollIntervalMs: params.pollIntervalMs ?? 2_000,
    };
  }
}

export const agcGlassStrategy = new AgcGlassStrategy();
