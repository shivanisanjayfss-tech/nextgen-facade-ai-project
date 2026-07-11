import {
  getDatasetItems,
  startActorRun,
  waitForActorRun,
  type ApifyActorRun,
} from "@/lib/apify";
import { isServiceError, ServiceError } from "@/lib/errors";
import { isApifyConfigured } from "@/lib/env";
import type { CrawledProduct, CrawlImportResult } from "@/types/import";

/** Apify's official Website Content Crawler (tilde form required by the REST API). */
export const WEBSITE_CONTENT_CRAWLER_ACTOR = "apify~website-content-crawler";

export interface ManufacturerImportOptions {
  /** Display / dedup source label (defaults to website hostname). */
  source?: string;
  /** Manufacturer name stored on each product row. */
  manufacturer: string;
  /** Start URL for the crawl — typically the manufacturer's products page. */
  websiteUrl: string;
  /** Default material category applied to every extracted product. */
  category: string;
  /** Optional override for product-page URL detection. */
  productPagePattern?: RegExp;
  /** Optional Apify includeUrlGlobs (defaults to common /products/ patterns). */
  includeUrlGlobs?: string[];
  /** Max pages to crawl. Default: 25. */
  maxPages?: number;
  /** Max products to return after extraction. Default: 50. */
  limit?: number;
  /** Max wait time for crawl completion. Default: 60s. */
  timeoutMs?: number;
  /** Poll interval while waiting. Default: 3s. */
  pollIntervalMs?: number;
}

interface CrawlerItem {
  url?: string;
  loadedUrl?: string;
  title?: string;
  text?: string;
  markdown?: string;
  html?: string;
  description?: string;
  metadata?: {
    title?: string;
    description?: string;
    canonicalUrl?: string;
    openGraph?: Array<{ property?: string; content?: string }>;
    jsonLd?: unknown;
    image?: string;
  };
  [key: string]: unknown;
}

interface ExtractionContext {
  manufacturer: string;
  category: string;
  productPagePattern?: RegExp;
  websiteUrl: string;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  return undefined;
}

function normalizeWebsiteUrl(url: string): string {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "") || parsed.origin;
}

function resolveSourceLabel(websiteUrl: string, source?: string): string {
  if (source) return source;
  return new URL(websiteUrl).hostname.replace(/^www\./, "");
}

function buildDefaultIncludeGlobs(websiteUrl: string): string[] {
  const origin = new URL(websiteUrl).origin;
  return [
    `${origin}/**/products/**`,
    `${origin}/**/product/**`,
    `${origin}/**/by-brand/**`,
    `${origin}/**/produkte/**`,
  ];
}

function buildExcludeGlobs(websiteUrl: string): string[] {
  const origin = new URL(websiteUrl).origin;
  return [
    `${origin}/**/*.jpg`,
    `${origin}/**/*.png`,
    `${origin}/**/*.pdf`,
    `${origin}/**/cart/**`,
    `${origin}/**/account/**`,
  ];
}

/** Strips common site/brand suffixes from a page title to isolate the product name. */
function cleanProductName(title: string, manufacturer: string): string {
  const escaped = manufacturer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return title
    .replace(new RegExp(`\\s*[|–-]\\s*(${escaped}|3A Composites).*?$`, "i"), "")
    .replace(/\u00ae/g, "")
    .trim();
}

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return (match[1] ?? match[0]).trim();
    }
  }
  return undefined;
}

function extractFireRating(text: string): string | undefined {
  return firstMatch(text, [
    /fire[\s-]*(?:rating|class|classification|resistance)\s*[:\-]?\s*([A-F][0-9]?(?:-s[0-3])?(?:,?\s?d[0-2])?)/i,
    /\b([A-F][12]?-s[0-3],?\s?d[0-2])\b/,
    /\beuroclass\s+([A-F][0-9]?(?:-s[0-3])?(?:,?\s?d[0-2])?)/i,
    /\b(non-?combustible)\b/i,
  ]);
}

function extractThickness(text: string): string | undefined {
  return firstMatch(text, [
    /thickness\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?(?:\s*[\/,-]\s*[0-9]+(?:\.[0-9]+)?)*\s*mm)/i,
    /\b([0-9]+(?:\.[0-9]+)?\s*mm)\s+thick\b/i,
    /panel\s+thickness\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?\s*mm)/i,
  ]);
}

function extractDimensions(text: string): string | undefined {
  const explicit = firstMatch(text, [
    /(?:dimensions?|panel\s+size|sheet\s+size|width\s*[x\u00d7]\s*length)\s*[:\-]?\s*([0-9]{2,4}\s*[x\u00d7]\s*[0-9]{2,4}(?:\s*mm)?)/i,
    /\b([0-9]{3,4}\s*[x\u00d7]\s*[0-9]{3,5}\s*mm)\b/i,
  ]);
  if (explicit) return explicit;

  const widthsRaw = firstMatch(text, [
    /production\s+widths?\s*\[?mm\]?\s*[:\-]?\s*([0-9()\/ .]+)/i,
    /width\s*\[mm\]\s*([0-9()\/ .]+)/i,
  ]);
  const length = firstMatch(text, [
    /length\s*\[?mm\]?\s*[:\-]?\s*([0-9]{3,4}\s*[\u2013-]\s*[0-9]{3,5})/i,
  ]);

  let widths: string | undefined;
  if (widthsRaw) {
    const seen = new Set<string>();
    for (const num of widthsRaw.match(/[0-9]{3,4}/g) ?? []) {
      seen.add(num);
    }
    if (seen.size > 0) {
      widths = Array.from(seen).slice(0, 6).join(" / ");
    }
  }

  if (widths && length) {
    return `Width ${widths} mm x Length ${length.trim()} mm`;
  }
  if (widths) return `Width ${widths} mm`;
  return undefined;
}

function extractDescription(item: CrawlerItem, text: string): string | undefined {
  const metaDescription =
    asString(item.metadata?.description) ?? asString(item.description);
  if (metaDescription) return metaDescription;

  const line = text
    .split("\n")
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 60 && !entry.startsWith("#"));

  return line;
}

function extractDatasheetUrl(item: CrawlerItem, rawText: string): string | undefined {
  const source = `${item.markdown ?? ""}\n${item.html ?? ""}\n${rawText ?? ""}`;

  const labelled = source.match(
    /https?:\/\/[^\s")'<>]*(?:datasheet|data-sheet|technical|declaration|approval)[^\s")'<>]*\.pdf(?:\?[^\s")'<>]*)?/i,
  );
  if (labelled) return labelled[0];

  const anyPdf = source.match(/https?:\/\/[^\s")'<>]+\.pdf(?:\?[^\s")'<>]*)?/i);
  return anyPdf?.[0];
}

function extractImageUrl(item: CrawlerItem): string | undefined {
  const og = item.metadata?.openGraph?.find(
    (entry) => entry.property === "og:image" || entry.property === "image",
  );
  const fromMeta =
    asString(og?.content) ??
    asString(item.metadata?.image) ??
    asString(item.metadata && (item.metadata as Record<string, unknown>).imageUrl);
  if (fromMeta) return fromMeta;

  const html = item.html ?? "";
  const metaMatch = html.match(
    /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i,
  );
  if (metaMatch) return metaMatch[1];

  const markdown = item.markdown ?? "";
  const mdImage = markdown.match(
    /!\[[^\]]*\]\(\s*(https?:\/\/[^)\s]+\.(?:jpg|jpeg|png|webp|avif|gif)(?:\?[^)\s"]*)?)(?:\s+"[^"]*")?\s*\)/i,
  );
  return mdImage?.[1];
}

function isProductPageUrl(url: string, context: ExtractionContext): boolean {
  if (context.productPagePattern) {
    return context.productPagePattern.test(url);
  }

  try {
    const normalized = url.replace(/\/$/, "");
    const start = context.websiteUrl.replace(/\/$/, "");
    if (normalized === start) return false;

    if (
      /\/(about|contact|news|blog|login|cart|search|privacy|terms|imprint|kontakt)(\/)?$/i.test(
        normalized,
      )
    ) {
      return false;
    }

    const urlObj = new URL(normalized);
    const startObj = new URL(start);
    if (urlObj.hostname !== startObj.hostname) return false;

    const segments = urlObj.pathname.split("/").filter(Boolean);
    const productIdx = segments.findIndex(
      (segment) =>
        segment === "products" ||
        segment === "product" ||
        segment === "produkte" ||
        segment === "by-brand",
    );

    if (productIdx >= 0) {
      return segments.length > productIdx + 1;
    }

    const startDepth = startObj.pathname.split("/").filter(Boolean).length;
    return segments.length > startDepth;
  } catch {
    return false;
  }
}

/** Converts a single crawled page into a structured product, or null if it isn't one. */
export function mapCrawlerItemToProduct(
  item: CrawlerItem,
  context: ExtractionContext,
): CrawledProduct | null {
  const sourceUrl =
    asString(item.url) ?? asString(item.loadedUrl) ?? context.websiteUrl;

  if (!isProductPageUrl(sourceUrl, context)) return null;

  const text = asString(item.text) ?? asString(item.markdown) ?? "";
  const rawTitle =
    asString(item.metadata?.title) ?? asString(item.title) ?? "";

  const productName = rawTitle ? cleanProductName(rawTitle, context.manufacturer) : "";
  if (!productName) return null;

  const haystack = `${rawTitle}\n${text}`;

  return {
    productName,
    manufacturer: context.manufacturer,
    category: context.category,
    fireRating: extractFireRating(haystack),
    thickness: extractThickness(haystack),
    dimensions: extractDimensions(haystack),
    description: extractDescription(item, text),
    datasheetUrl: extractDatasheetUrl(item, text),
    imageUrl: extractImageUrl(item),
    sourceUrl,
  };
}

function buildCrawlerInput(
  websiteUrl: string,
  maxPages: number,
  includeUrlGlobs: string[],
  excludeUrlGlobs: string[],
): Record<string, unknown> {
  return {
    startUrls: [{ url: websiteUrl }],
    crawlerType: "cheerio",
    includeUrlGlobs: includeUrlGlobs.map((glob) => ({ glob })),
    excludeUrlGlobs: excludeUrlGlobs.map((glob) => ({ glob })),
    maxCrawlPages: maxPages,
    maxCrawlDepth: 4,
    saveMarkdown: true,
    saveHtml: true,
    proxyConfiguration: { useApifyProxy: true },
  };
}

/**
 * Crawls a manufacturer website via the Website Content Crawler and returns
 * structured product data ready for Supabase persistence.
 */
export async function importManufacturerProducts(
  options: ManufacturerImportOptions,
): Promise<CrawlImportResult> {
  const notes: string[] = [];

  if (!isApifyConfigured()) {
    throw new ServiceError(
      "APIFY_API_TOKEN is not configured. Add it to .env.local and restart the dev server.",
      "MISSING_API_KEY",
      503,
    );
  }

  let websiteUrl: string;
  try {
    websiteUrl = normalizeWebsiteUrl(options.websiteUrl);
  } catch {
    throw new ServiceError("Invalid website URL.", "INVALID_REQUEST", 400);
  }

  const manufacturer = options.manufacturer.trim();
  const category = options.category.trim();

  if (!manufacturer) {
    throw new ServiceError("Manufacturer name is required.", "INVALID_REQUEST", 400);
  }

  if (!category) {
    throw new ServiceError("Category is required.", "INVALID_REQUEST", 400);
  }

  const maxPages = options.maxPages ?? 25;
  const limit = options.limit ?? 50;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const pollIntervalMs = options.pollIntervalMs ?? 3_000;

  const includeUrlGlobs =
    options.includeUrlGlobs ?? buildDefaultIncludeGlobs(websiteUrl);
  const excludeUrlGlobs = buildExcludeGlobs(websiteUrl);

  const extractionContext: ExtractionContext = {
    manufacturer,
    category,
    productPagePattern: options.productPagePattern,
    websiteUrl,
  };

  const run = await startActorRun(
    WEBSITE_CONTENT_CRAWLER_ACTOR,
    buildCrawlerInput(websiteUrl, maxPages, includeUrlGlobs, excludeUrlGlobs),
  );

  let finalRun: ApifyActorRun = run;
  let finished = false;

  try {
    finalRun = await waitForActorRun(run.id, { timeoutMs, pollIntervalMs });
    finished = true;
  } catch (error) {
    if (isServiceError(error) && error.code === "APIFY_TIMEOUT") {
      notes.push(
        `Crawl did not finish within ${timeoutMs}ms — returning partial results captured so far.`,
      );
    } else {
      throw error;
    }
  }

  const rawItems = await getDatasetItems<CrawlerItem>(finalRun.defaultDatasetId, {
    limit,
  });

  const products = rawItems
    .map((item) => mapCrawlerItemToProduct(item, extractionContext))
    .filter((product): product is CrawledProduct => product !== null);

  if (finished && products.length === 0) {
    notes.push(
      "Crawl finished but no product pages matched the extraction rules. Try a more specific products URL or pass custom includeUrlGlobs.",
    );
  }

  return {
    source: resolveSourceLabel(websiteUrl, options.source),
    manufacturer,
    website_url: websiteUrl,
    category,
    actor_id: WEBSITE_CONTENT_CRAWLER_ACTOR,
    run_id: finalRun.id,
    dataset_id: finalRun.defaultDatasetId,
    status: finalRun.status,
    finished,
    crawled_pages: rawItems.length,
    product_count: products.length,
    products,
    notes,
  };
}
