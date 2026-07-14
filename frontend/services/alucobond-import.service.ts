import type { ManufacturerImportOptions } from "@/services/manufacturer-import.service";
import { importManufacturerProducts } from "@/services/manufacturer-import.service";

export {
  WEBSITE_CONTENT_CRAWLER_ACTOR,
  mapCrawlerItemToProduct,
} from "@/services/manufacturer-import.service";

const ALUCOBOND_PRODUCTS_URL = "https://www.alucobond.com/en/products/";
const ALUCOBOND_BASE = "https://www.alucobond.com";

export interface AlucobondImportOptions {
  maxPages?: number;
  limit?: number;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

/** Alucobond-specific import config — delegates to the generic manufacturer importer. */
export async function importAlucobondProducts(
  options: AlucobondImportOptions = {},
): Promise<ReturnType<typeof importManufacturerProducts>> {
  const config: ManufacturerImportOptions = {
    source: "alucobond.com",
    manufacturer: "Alucobond",
    websiteUrl: ALUCOBOND_PRODUCTS_URL,
    category: "ACP",
    productPagePattern: /\/products\/by-brand\/[^/]+/i,
    includeUrlGlobs: [`${ALUCOBOND_BASE}/en/products/by-brand/**`],
    skipHomepageDiscovery: true,
    maxCrawlDepth: 4,
    maxPages: options.maxPages,
    limit: options.limit,
    timeoutMs: options.timeoutMs,
    pollIntervalMs: options.pollIntervalMs,
  };

  return importManufacturerProducts(config);
}
