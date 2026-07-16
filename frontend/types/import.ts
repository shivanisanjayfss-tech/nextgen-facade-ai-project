/** Normalized material record returned by Apify import — ready for DB upsert. */
export interface ImportedMaterialData {
  name: string;
  manufacturer: string;
  category: string;
  description: string;
  specs: Record<string, string | undefined>;
  datasheet_url?: string;
}

/** High-level classification of an imported catalogue entry. */
export type ProductType = "Product" | "Colour Series" | "Product Family";

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
  brand?: string;
  category: string;
  fireRating?: string;
  thickness?: string;
  dimensions?: string;
  description?: string;
  datasheetUrl?: string;
  imageUrl?: string;
  galleryImages?: string[];
  brochureUrl?: string;
  installationGuideUrl?: string;
  technicalManualUrl?: string;
  maintenanceGuideUrl?: string;
  sourceUrl: string;
  /** High-level catalogue classification persisted to specs.productType. */
  productType?: ProductType;
  /** Alucobond page classification when detected during import. */
  pageType?: "product" | "product-family" | "colour-series";
  colourSeriesName?: string;
  productFamily?: string;
  finish?: string;
  surface?: string;
  availableColours?: string[];
  /** Key product features / benefits extracted from the page (bullet lists). */
  features?: string[];
  /** Applications / use cases extracted from the page (bullet lists). */
  applications?: string[];
  /** Certifications / compliance statements extracted from the page. */
  certifications?: string[];
  warranty?: string;
  coreMaterial?: string;
  weight?: string;
  panelWeight?: string;
  thermalConductivity?: string;
  windLoad?: string;
  uValue?: string;
  /** Generic technical specs extracted from the product page (canonical keys). */
  technicalSpecs?: Record<string, string>;
  inheritSpecsFromSlug?: string;
  inheritedSpecsFrom?: string;
}

/** Page skipped during crawl extraction — navigation, informational, or failed quality checks. */
export interface IgnoredPage {
  url: string;
  reason: string;
}

/** Snapshot of crawl progress captured during Apify run polling. */
export interface CrawlPollUpdate {
  polled_at: string;
  status: string;
  crawled_pages: number;
  crawl_urls: string[];
}

/** High-level import counts returned after crawl extraction and persistence. */
export interface ImportSummary {
  imported: number;
  updated: number;
  skipped: number;
  ignored: number;
  duplicates_merged: number;
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
  /** Status snapshots recorded every poll interval while the actor runs. */
  poll_updates: CrawlPollUpdate[];
  /** Exact Apify actor input JSON sent to the Website Content Crawler. */
  actor_input?: Record<string, unknown>;
  /** Apify Console URL for the actor run. */
  actor_run_url?: string;
  /** Actor run log — populated only when the crawl produced zero pages. */
  actor_logs?: string;
  /** Crawled pages excluded from import (navigation, informational, or incomplete). */
  ignored_pages: IgnoredPage[];
  /** Convenience counts — imported/skipped from DB, ignored from extraction filters. */
  import_summary?: ImportSummary;
  notes: string[];
  persist?: MaterialPersistResult;
}

/** Per-product decision recorded during import persistence. */
export type MaterialPersistOutcome = "imported" | "updated" | "skipped" | "failed";

export interface MaterialPersistDecision {
  productName: string;
  sourceUrl: string;
  slug: string;
  outcome: MaterialPersistOutcome;
  matchKind: "source_url" | "slug" | "manufacturer_name" | "none";
  reason: string;
  statusReasons: string[];
  changedFields: Array<{
    field: string;
    previous: string;
    next: string;
  }>;
  unchangedFields: string[];
  errorMessage?: string;
}

export interface MaterialPersistResult {
  imported: number;
  updated: number;
  skipped: number;
  duplicates_merged: number;
  errors: Array<{
    sourceUrl: string;
    productName: string;
    message: string;
  }>;
  decisions: MaterialPersistDecision[];
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
