import type { CrawlImportResult } from "@/types/import";
import type { ImportHistoryDiagnostics } from "@/types/import-diagnostics";

/** Builds the diagnostics JSONB payload from a crawl result. */
export function buildImportHistoryDiagnostics(
  crawlResult: CrawlImportResult,
): ImportHistoryDiagnostics {
  return {
    poll_updates: crawlResult.poll_updates ?? [],
    ignored_pages: crawlResult.ignored_pages ?? [],
    crawl_urls: crawlResult.crawl_urls ?? [],
    notes: crawlResult.notes ?? [],
    actor_logs: crawlResult.actor_logs,
    discovered_product_urls: crawlResult.discovered_product_urls ?? [],
    crawl_start_urls: crawlResult.crawl_start_urls ?? [],
    actor_input: crawlResult.actor_input,
  };
}
