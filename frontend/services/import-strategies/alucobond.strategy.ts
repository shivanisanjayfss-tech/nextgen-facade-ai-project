import type { ImportLimits } from "@/services/import-limits";
import type { ManufacturerImportOptions } from "@/services/manufacturer-import.service";
import type {
  ManufacturerImportStrategy,
  StrategyBuildParams,
} from "@/services/import-strategies/types";

const ALUCOBOND_PRODUCTS_URL = "https://www.alucobond.com/en/products/";
const ALUCOBOND_BASE = "https://www.alucobond.com";

export class AlucobondStrategy implements ManufacturerImportStrategy {
  readonly id = "alucobond";
  readonly displayName = "Alucobond";

  matches(manufacturer: string): boolean {
    return manufacturer.trim().toLowerCase() === "alucobond";
  }

  getImportLimits(): ImportLimits {
    return { maxPages: 25, limit: 25, timeout: 60_000 };
  }

  buildOptions(params: StrategyBuildParams): ManufacturerImportOptions {
    const limits = this.getImportLimits();

    return {
      source: "alucobond.com",
      manufacturer: "Alucobond",
      websiteUrl: ALUCOBOND_PRODUCTS_URL,
      category: params.category || "ACP Sheet",
      productPagePattern: /\/products\/(?:by-brand|by-colour-series)\/[^/]+/i,
      includeUrlGlobs: [
        `${ALUCOBOND_BASE}/en/products/by-brand/**`,
        `${ALUCOBOND_BASE}/en/products/by-colour-series/**`,
      ],
      skipHomepageDiscovery: true,
      maxCrawlDepth: 3,
      maxPages: params.maxPages ?? 25,
      limit: params.limit ?? 25,
      timeoutMs: params.timeoutMs ?? limits.timeout,
      pollIntervalMs: params.pollIntervalMs ?? 2_000,
    };
  }
}

export const alucobondStrategy = new AlucobondStrategy();
