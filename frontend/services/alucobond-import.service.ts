import {
  importManufacturerProducts,
  WEBSITE_CONTENT_CRAWLER_ACTOR,
  mapCrawlerItemToProduct,
} from "@/services/manufacturer-import.service";
import { alucobondStrategy } from "@/services/import-strategies";

export { WEBSITE_CONTENT_CRAWLER_ACTOR, mapCrawlerItemToProduct };

export interface AlucobondImportOptions {
  maxPages?: number;
  limit?: number;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

/** Alucobond-specific import — uses AlucobondStrategy. */
export async function importAlucobondProducts(
  options: AlucobondImportOptions = {},
): Promise<ReturnType<typeof importManufacturerProducts>> {
  const config = alucobondStrategy.buildOptions({
    manufacturer: "3A Composites",
    websiteUrl: "https://www.alucobond.com/en/products/",
    category: "ACP Sheet",
    maxPages: options.maxPages,
    limit: options.limit,
    timeoutMs: options.timeoutMs,
    pollIntervalMs: options.pollIntervalMs,
  });

  return importManufacturerProducts(config);
}
