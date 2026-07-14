/** Normalized material record returned by Apify import — ready for DB upsert. */
export interface ImportedMaterialData {
  name: string;
  manufacturer: string;
  category: string;
  description: string;
  specs: Record<string, string | undefined>;
  datasheet_url?: string;
}

export type ApifyRunStatus =
  | "READY"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "TIMING-OUT"
  | "TIMED-OUT"
  | "ABORTING"
  | "ABORTED";

/**
 * Structured product record extracted from a crawled manufacturer page.
 * Field names mirror the requested Alucobond import contract (not yet persisted).
 */
export interface CrawledProduct {
  productName: string;
  manufacturer: string;
  category: string;
  fireRating?: string;
  thickness?: string;
  dimensions?: string;
  description?: string;
  datasheetUrl?: string;
  imageUrl?: string;
  sourceUrl: string;
}

/** Page skipped during crawl extraction — navigation, informational, or failed quality checks. */
export interface IgnoredPage {
  url: string;
  reason: string;
}

/** High-level import counts returned after crawl extraction and persistence. */
export interface ImportSummary {
  imported: number;
  skipped: number;
  ignored: number;
}

/** Response shape for a crawl + persist import run. */
export interface CrawlImportResult {
  source: string;
  manufacturer?: string;
  website_url?: string;
  category?: string;
  actor_id: string;
  run_id?: string;
  dataset_id?: string;
  status: string;
  finished: boolean;
  crawled_pages: number;
  product_count: number;
  products: CrawledProduct[];
  /** Product-page URLs identified from the crawl before field extraction. */
  discovered_product_urls: string[];
  /** Entry URLs discovered from a homepage link scan (empty when not applicable). */
  discovered_entry_urls: string[];
  /** Start URLs sent to the crawler (catalogue entry points). */
  crawl_start_urls: string[];
  /** All page URLs returned by the crawler before product extraction. */
  crawl_urls: string[];
  /** Crawled pages excluded from import (navigation, informational, or incomplete). */
  ignored_pages: IgnoredPage[];
  /** Convenience counts — imported/skipped from DB, ignored from extraction filters. */
  import_summary?: ImportSummary;
  notes: string[];
  persist?: MaterialPersistResult;
}

/** Counts returned after upserting crawled products into Supabase. */
export interface MaterialPersistResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{
    sourceUrl: string;
    productName: string;
    message: string;
  }>;
}

/** Result of a material import run — suitable for cron jobs and audit logs. */
export interface MaterialImportResult {
  run_id: string;
  dataset_id: string;
  actor_id: string;
  status: ApifyRunStatus;
  started_at: string;
  finished_at?: string;
  item_count: number;
  materials: ImportedMaterialData[];
}
