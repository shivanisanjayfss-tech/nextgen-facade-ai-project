import {
  ALPOLIC_BASE,
  ALPOLIC_CATALOGUE_URL,
  ALPOLIC_ENTRY_URLS,
  isAlpolicNavigationPage,
  isAlpolicProductUrl,
} from "@/lib/alpolic-products";
import type { ImportLimits } from "@/services/import-limits";
import { isNavigationOrInformationalPage } from "@/services/manufacturer-import.service";
import type {
  ManufacturerImportStrategy,
  StrategyBuildParams,
} from "@/services/import-strategies/types";
import type { ManufacturerImportOptions } from "@/services/manufacturer-import.service";

export function isMitsubishiAlpolicProductPage(url: string): boolean {
  if (isNavigationOrInformationalPage(url)) return false;
  if (isAlpolicNavigationPage(url)) return false;
  return isAlpolicProductUrl(url);
}

export class MitsubishiChemicalStrategy implements ManufacturerImportStrategy {
  readonly id = "mitsubishi-chemical";
  readonly displayName = "Mitsubishi Chemical";

  matches(manufacturer: string): boolean {
    const normalized = manufacturer.trim().toLowerCase();
    return (
      normalized === "mitsubishi chemical" ||
      normalized === "mitsubishi" ||
      normalized === "alpolic"
    );
  }

  getImportLimits(): ImportLimits {
    return { maxPages: 15, limit: 15, timeout: 120_000 };
  }

  buildOptions(params: StrategyBuildParams): ManufacturerImportOptions {
    const limits = this.getImportLimits();

    return {
      source: "alpolic.com",
      manufacturer: "Mitsubishi Chemical",
      brand: "ALPOLIC",
      websiteUrl: ALPOLIC_CATALOGUE_URL,
      category: params.category || "ACP Sheet",
      productPageMatcher: isMitsubishiAlpolicProductPage,
      includeUrlGlobs: [
        `${ALPOLIC_BASE}/alpolic-intl/**`,
        `${ALPOLIC_BASE}/alpolic-intl/product_*/**`,
      ],
      entryUrls: [...ALPOLIC_ENTRY_URLS],
      skipHomepageDiscovery: true,
      maxCrawlDepth: 2,
      crawlerType: "cheerio",
      maxPages: params.maxPages ?? limits.maxPages,
      limit: params.limit ?? limits.limit,
      timeoutMs: params.timeoutMs ?? limits.timeout,
      pollIntervalMs: params.pollIntervalMs ?? 2_000,
    };
  }
}

export const mitsubishiChemicalStrategy = new MitsubishiChemicalStrategy();
