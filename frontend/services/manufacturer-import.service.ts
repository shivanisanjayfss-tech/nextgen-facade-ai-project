import {
  isAlucobondCatalogueEntry,
} from "@/lib/manufacturer-catalog";
import {
  detectAlucobondPageType,
  enrichAlucobondColourSeriesProduct,
  isAlucobondColourSeriesUrl,
} from "@/lib/alucobond-colour-series";
import {
  enrichAlpolicProduct,
  finalizeAlpolicProducts,
  isAlpolicProductUrl,
} from "@/lib/alpolic-products";
import { enrichGlassProduct, isGlassManufacturerUrl } from "@/lib/glass-products";
import {
  isGenericProductName,
  resolveAlucobondProductNameFromUrl,
} from "@/lib/alucobond-product-names";
import { extractProductMedia } from "@/lib/product-media";
import {
  extractApplicationList,
  extractCertificationList,
  extractFeatureList,
  extractTechnicalSpecs,
} from "@/lib/spec-extraction";
import {
  buildRunConsoleUrl,
  getActorRun,
  getActorRunLog,
  getDatasetItems,
  resolveActorMemoryMbytes,
  startActorRun,
  type ApifyActorRun,
} from "@/lib/apify";
import { isServiceError, ServiceError } from "@/lib/errors";
import { isApifyConfigured } from "@/lib/env";
import { logImportSchedulerStage } from "@/lib/import-scheduler-logger";
import type { CrawledProduct, CrawlImportResult, IgnoredPage } from "@/types/import";

/** Apify's official Website Content Crawler (tilde form required by the REST API). */
export const WEBSITE_CONTENT_CRAWLER_ACTOR = "apify~website-content-crawler";

export interface ManufacturerImportOptions {
  /** Display / dedup source label (defaults to website hostname). */
  source?: string;
  /** Manufacturer name stored on each product row. */
  manufacturer: string;
  /** Product brand stored in specs.brand when applicable. */
  brand?: string;
  /** Start URL for the crawl — typically the manufacturer's products page. */
  websiteUrl: string;
  /** Default material category applied to every extracted product. */
  category: string;
  /** Optional override for product-page URL detection. */
  productPagePattern?: RegExp;
  /** Optional custom matcher for product-page URL detection. */
  productPageMatcher?: (url: string) => boolean;
  /** Optional Apify includeUrlGlobs (defaults to common product path patterns). */
  includeUrlGlobs?: string[];
  /** Predefined crawl entry URLs (skips homepage link discovery when set). */
  entryUrls?: string[];
  /** Skip homepage link discovery even when the start URL is a homepage. */
  skipHomepageDiscovery?: boolean;
  /** Apify maxCrawlDepth. Default: 3 for generic imports. */
  maxCrawlDepth?: number;
  /** Max pages to crawl. Default: 50. */
  maxPages?: number;
  /** Max products to return after extraction. Default: 50. */
  limit?: number;
  /** Max wait time for crawl completion. Default: 60s. */
  timeoutMs?: number;
  /** Poll interval while waiting. Default: 2s. */
  pollIntervalMs?: number;
  /** Stop waiting once this many valid products are extracted from partial crawl data. */
  earlyExitProductCount?: number;
  /** Crawler engine passed to Apify. Default: cheerio. */
  crawlerType?: "cheerio" | "playwright:chrome" | "playwright:adaptive";
  /** Optional Apify proxy groups (e.g. RESIDENTIAL) for bot-protected sites. */
  proxyGroups?: string[];
  /** Heartbeat while polling Apify (scheduler live progress). */
  onCrawlPoll?: (update: {
    status: string;
    crawledPages: number;
  }) => void | Promise<void>;
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
  brand?: string;
  category: string;
  productPagePattern?: RegExp;
  productPageMatcher?: (url: string) => boolean;
  websiteUrl: string;
}

/** Path slugs that indicate navigation or informational pages, not products. */
export const NAVIGATION_PATH_SLUGS = new Set([
  "discover-our-products",
  "find-a-guardian-glass-supplier",
  "become-our-partner",
  "range-listing",
  "about",
  "contact",
  "news",
  "blog",
  "login",
  "cart",
  "search",
  "privacy",
  "terms",
  "imprint",
  "kontakt",
  "resources",
  "tools",
  "training",
  "help",
  "careers",
  "projects",
  "project-locator",
  "showcase-projects",
  "digital-glass-selector",
]);

export const MIN_PRODUCT_DESCRIPTION_LENGTH = 50;

const NAVIGATION_DESCRIPTION_PATTERNS = [
  /find a (?:guardian glass )?supplier/i,
  /discover all our products/i,
  /become (?:our partner|a dealer)/i,
  /search and filter through our/i,
  /range listing/i,
  /locate projects around the world/i,
] as const;

/** Path keywords used to discover and classify product pages. */
const PRODUCT_PATH_KEYWORDS = [
  "products",
  "product",
  "solutions",
  "glass",
  "catalogue",
  "catalog",
  "applications",
  "produkte",
  "by-brand",
] as const;

const HOMEPAGE_LINK_KEYWORDS = [
  "products",
  "product",
  "solutions",
  "glass",
  "catalogue",
  "catalog",
  "applications",
] as const;

const PRODUCT_SEGMENT_NAMES = new Set<string>(PRODUCT_PATH_KEYWORDS);

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
  return PRODUCT_PATH_KEYWORDS.map((keyword) => `${origin}/**/${keyword}/**`);
}

function pathContainsIgnoredSlug(pathname: string, extraSlugs?: Set<string>): boolean {
  const segments = pathname.split("/").filter(Boolean).map((segment) => segment.toLowerCase());
  const ignored = extraSlugs ?? NAVIGATION_PATH_SLUGS;

  return segments.some((segment) => ignored.has(segment));
}

/** Returns true when a URL path looks like navigation or informational content. */
export function isNavigationOrInformationalPage(
  url: string,
  extraSlugs?: Set<string>,
): boolean {
  try {
    const pathname = new URL(url).pathname;
    if (pathContainsIgnoredSlug(pathname, extraSlugs)) return true;

    return /\/(about|contact|news|blog|login|cart|search|privacy|terms|imprint|kontakt)(\/|$)/i.test(
      pathname,
    );
  } catch {
    return false;
  }
}

function isValidProductDescription(description: string | undefined): boolean {
  if (!description) return false;
  const trimmed = description.trim();
  if (trimmed.length < MIN_PRODUCT_DESCRIPTION_LENGTH) return false;
  return !isNavigationDescription(trimmed);
}

function isValidProductName(name: string): boolean {
  if (!name || name.length < 2) return false;
  if (name.length > 100) return false;
  if (isGenericProductName(name)) return false;
  return !/\s+is\s+(?:a|an)\s+/i.test(name);
}

function trimSentenceFragment(name: string): string {
  const sentenceBreak = name.search(/\s+is\s+(?:a|an)\s+/i);
  if (sentenceBreak > 0 && sentenceBreak < 80) {
    return name.slice(0, sentenceBreak).trim();
  }
  return name;
}

/** Returns a cleaned product name candidate, or undefined when generic/empty. */
function toProductNameCandidate(
  candidate: string | undefined,
  manufacturer: string,
): string | undefined {
  if (!candidate) return undefined;

  const cleaned = trimSentenceFragment(cleanProductName(candidate, manufacturer));
  if (!cleaned || isGenericProductName(cleaned)) return undefined;
  return cleaned;
}

function extractOpenGraphTitle(item: CrawlerItem): string | undefined {
  const openGraph = item.metadata?.openGraph;
  if (!Array.isArray(openGraph)) return undefined;

  const titleKeys = ["og:title", "twitter:title"];
  for (const key of titleKeys) {
    const entry = openGraph.find(
      (node) => node.property?.toLowerCase() === key.toLowerCase(),
    );
    const content = asString(entry?.content);
    if (content) return content;
  }

  return undefined;
}

function extractNameFromJsonLdNode(node: unknown): string | undefined {
  if (typeof node !== "object" || node === null) return undefined;

  const record = node as Record<string, unknown>;
  const typeValue = record["@type"];
  const types = Array.isArray(typeValue) ? typeValue : [typeValue];
  const isProduct = types.some(
    (type) => typeof type === "string" && /product/i.test(type),
  );

  if (!isProduct) return undefined;
  return asString(record.name);
}

function extractJsonLdProductName(item: CrawlerItem): string | undefined {
  const jsonLd = item.metadata?.jsonLd;
  if (!jsonLd) return undefined;

  const nodes = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
  for (const node of nodes) {
    if (typeof node !== "object" || node === null) continue;

    const record = node as Record<string, unknown>;
    if (Array.isArray(record["@graph"])) {
      for (const graphNode of record["@graph"]) {
        const name = extractNameFromJsonLdNode(graphNode);
        if (name) return name;
      }
    }

    const name = extractNameFromJsonLdNode(record);
    if (name) return name;
  }

  return undefined;
}

function extractBreadcrumbProductName(item: CrawlerItem): string | undefined {
  const html = item.html ?? "";
  if (!html) return undefined;

  const breadcrumbSection = html.match(
    /<(nav|ol|ul)[^>]*(?:breadcrumb|breadcrumbs)[^>]*>([\s\S]*?)<\/\1>/i,
  )?.[2];

  if (breadcrumbSection) {
    const crumbs = [
      ...breadcrumbSection.matchAll(/<(?:a|span|li)[^>]*>([^<]+)<\/(?:a|span|li)>/gi),
    ]
      .map((match) => match[1]?.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    const last = crumbs[crumbs.length - 1];
    if (last) return last;
  }

  const jsonLd = item.metadata?.jsonLd;
  if (!jsonLd) return undefined;

  const nodes = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
  for (const node of nodes) {
    if (typeof node !== "object" || node === null) continue;
    const record = node as Record<string, unknown>;
    const typeValue = record["@type"];
    const types = Array.isArray(typeValue) ? typeValue : [typeValue];

    if (!types.some((type) => typeof type === "string" && /breadcrumb/i.test(type))) {
      continue;
    }

    const items = record.itemListElement;
    if (!Array.isArray(items) || items.length === 0) continue;

    const lastItem = items[items.length - 1] as Record<string, unknown>;
    const name = asString(lastItem.name) ?? asString((lastItem.item as Record<string, unknown>)?.name);
    if (name) return name;
  }

  return undefined;
}

/** Extracts a product title from secondary headings in the main content area. */
function extractMainContentProductTitle(
  markdown: string,
  html: string,
): string | undefined {
  for (const match of markdown.matchAll(/^##\s+(.+)$/gm)) {
    const heading = match[1]?.trim();
    if (heading && !isGenericProductName(heading)) return heading;
  }

  for (const match of html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)) {
    const plain = match[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (plain && !isGenericProductName(plain)) return plain;
  }

  return undefined;
}

/** Strips common site/brand suffixes from a page title to isolate the product name. */
function cleanProductName(title: string, manufacturer: string): string {
  const escaped = manufacturer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return title
    .replace(new RegExp(`\\s*[|–-]\\s*(${escaped}|3A Composites).*?$`, "i"), "")
    .replace(/\u00ae|\u2122/g, "")
    .trim();
}

function extractProductName(
  item: CrawlerItem,
  rawTitle: string,
  manufacturer: string,
): string {
  const markdown = item.markdown ?? "";
  const html = item.html ?? "";
  const isAlucobond = isAlucobondCatalogueEntry(manufacturer);
  const sourceUrl = asString(item.url) ?? asString(item.loadedUrl) ?? "";

  const markdownHeading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const fromMarkdown = toProductNameCandidate(markdownHeading, manufacturer);
  if (fromMarkdown) return fromMarkdown;

  const htmlHeading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (htmlHeading) {
    const plainHeading = htmlHeading.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const fromHtml = toProductNameCandidate(plainHeading, manufacturer);
    if (fromHtml) return fromHtml;
  }

  if (isAlucobond) {
    const fromContent = toProductNameCandidate(
      extractMainContentProductTitle(markdown, html),
      manufacturer,
    );
    if (fromContent) return fromContent;

    const fromOg = toProductNameCandidate(extractOpenGraphTitle(item), manufacturer);
    if (fromOg) return fromOg;

    const fromJsonLd = toProductNameCandidate(extractJsonLdProductName(item), manufacturer);
    if (fromJsonLd) return fromJsonLd;

    const fromBreadcrumb = toProductNameCandidate(
      extractBreadcrumbProductName(item),
      manufacturer,
    );
    if (fromBreadcrumb) return fromBreadcrumb;

    const fromUrl = toProductNameCandidate(
      resolveAlucobondProductNameFromUrl(sourceUrl),
      manufacturer,
    );
    if (fromUrl) return fromUrl;

    // Never use the website <title> for Alucobond product pages.
    return "";
  }

  const fromTitle = toProductNameCandidate(rawTitle, manufacturer);
  return fromTitle ?? "";
}

function pathContainsProductKeyword(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  return HOMEPAGE_LINK_KEYWORDS.some(
    (keyword) =>
      lower.includes(`/${keyword}/`) ||
      lower.endsWith(`/${keyword}`) ||
      lower.includes(`-${keyword}`),
  );
}

/** Returns true when the URL is a site root or language-only landing page. */
function isHomepageUrl(url: string): boolean {
  const parsed = new URL(url);
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return true;
  if (segments.length === 1 && /^[a-z]{2}(-[a-z]{2})?$/i.test(segments[0]!)) {
    return true;
  }
  return false;
}

/** Scans a homepage for same-origin links that likely lead to product sections. */
async function discoverHomepageEntryUrls(homepageUrl: string): Promise<string[]> {
  const origin = new URL(homepageUrl).origin;
  const discovered = new Set<string>();

  try {
    const response = await fetch(homepageUrl, {
      headers: {
        "User-Agent": "NextGenFacadeAI-Importer/1.0",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });

    if (!response.ok) return [];

    const html = await response.text();
    const hrefPattern = /href=["']([^"'#]+)["']/gi;
    let match: RegExpExecArray | null;

    while ((match = hrefPattern.exec(html)) !== null) {
      try {
        const absolute = new URL(match[1], homepageUrl);
        if (absolute.origin !== origin) continue;
        if (!pathContainsProductKeyword(absolute.pathname)) continue;
        discovered.add(normalizeWebsiteUrl(absolute.href));
      } catch {
        continue;
      }
    }
  } catch {
    return [];
  }

  return Array.from(discovered).slice(0, 20);
}

function resolveCrawlerStartUrls(
  websiteUrl: string,
  discoveredEntryUrls: string[],
): Array<{ url: string }> {
  if (discoveredEntryUrls.length > 0) {
    return discoveredEntryUrls.map((url) => ({ url }));
  }

  return [{ url: websiteUrl }];
}

function buildExcludeGlobs(websiteUrl: string): string[] {
  const origin = new URL(websiteUrl).origin;
  const navigationGlobs = Array.from(NAVIGATION_PATH_SLUGS).map(
    (slug) => `${origin}/**/${slug}/**`,
  );

  return [
    `${origin}/**/*.jpg`,
    `${origin}/**/*.png`,
    `${origin}/**/*.pdf`,
    `${origin}/**/cart/**`,
    `${origin}/**/account/**`,
    ...navigationGlobs,
  ];
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

function isNavigationDescription(description: string): boolean {
  return NAVIGATION_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(description));
}

function extractDescription(item: CrawlerItem, text: string): string | undefined {
  const candidates: string[] = [];

  const metaDescription =
    asString(item.metadata?.description) ?? asString(item.description);
  if (metaDescription) candidates.push(metaDescription);

  const paragraphs = text
    .split(/\n{2,}/)
    .map((entry) => entry.replace(/^#+\s*/, "").replace(/\s+/g, " ").trim())
    .filter(
      (entry) =>
        entry.length >= MIN_PRODUCT_DESCRIPTION_LENGTH &&
        !entry.startsWith("http") &&
        !/^(\*|•|-)\s/.test(entry) &&
        !isNavigationDescription(entry),
    );

  candidates.push(...paragraphs);

  return candidates.find(
    (entry) =>
      entry.length >= MIN_PRODUCT_DESCRIPTION_LENGTH &&
      !isNavigationDescription(entry),
  );
}

function enrichAlucobondCrawledProduct(
  item: CrawlerItem,
  product: CrawledProduct,
  sourceUrl: string,
): CrawledProduct {
  const pageType = detectAlucobondPageType(sourceUrl);

  if (pageType === "colour-series" || isAlucobondColourSeriesUrl(sourceUrl)) {
    return enrichAlucobondColourSeriesProduct(item, {
      ...product,
      pageType: "colour-series",
    });
  }

  if (pageType === "product") {
    return { ...product, pageType: "product" };
  }

  if (pageType === "product-family") {
    return { ...product, pageType: "product-family" };
  }

  return product;
}

function isProductPageUrl(url: string, context: ExtractionContext): boolean {
  if (isNavigationOrInformationalPage(url)) return false;

  if (context.productPageMatcher) {
    return context.productPageMatcher(url);
  }

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
    const productIdx = segments.findIndex((segment) =>
      PRODUCT_SEGMENT_NAMES.has(segment.toLowerCase()),
    );

    if (productIdx >= 0) {
      return segments.length > productIdx + 1;
    }

    if (pathContainsProductKeyword(urlObj.pathname)) {
      return segments.length >= 2;
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
  options: { skipUrlCheck?: boolean } = {},
): CrawledProduct | null {
  const sourceUrl =
    asString(item.url) ?? asString(item.loadedUrl) ?? context.websiteUrl;

  if (!options.skipUrlCheck && !isProductPageUrl(sourceUrl, context)) return null;

  const text = asString(item.text) ?? asString(item.markdown) ?? "";
  const rawTitle =
    asString(item.metadata?.title) ?? asString(item.title) ?? "";

  const productName = rawTitle
    ? extractProductName(item, rawTitle, context.manufacturer)
    : "";
  if (!isValidProductName(productName)) return null;

  const description = extractDescription(item, text);
  if (!isValidProductDescription(description)) return null;

  const markdown = asString(item.markdown) ?? "";
  const html = asString(item.html) ?? "";
  const haystack = `${rawTitle}\n${text}`;
  const specSource = [markdown, text].filter(Boolean).join("\n");
  const technicalSpecs = extractTechnicalSpecs(specSource, html);
  const features = extractFeatureList(specSource, html);
  const applications = extractApplicationList(specSource, html);
  const certifications = extractCertificationList(specSource, html);
  const media = extractProductMedia(item, sourceUrl);

  const baseProduct: CrawledProduct = {
    productName,
    manufacturer: context.manufacturer.trim(),
    brand: context.brand,
    category: context.category,
    fireRating: extractFireRating(haystack),
    thickness: extractThickness(haystack),
    dimensions: extractDimensions(haystack),
    technicalSpecs: Object.keys(technicalSpecs).length > 0 ? technicalSpecs : undefined,
    features: features.length > 0 ? features : undefined,
    applications: applications.length > 0 ? applications : undefined,
    certifications: certifications.length > 0 ? certifications : undefined,
    description,
    datasheetUrl: media.datasheetUrl,
    imageUrl: media.mainImageUrl,
    galleryImages: media.galleryImages.length > 0 ? media.galleryImages : undefined,
    brochureUrl: media.brochureUrl,
    installationGuideUrl: media.installationGuideUrl,
    technicalManualUrl: media.technicalManualUrl,
    maintenanceGuideUrl: media.maintenanceGuideUrl,
    sourceUrl,
  };

  if (isAlucobondCatalogueEntry(context.manufacturer, sourceUrl)) {
    return enrichAlucobondCrawledProduct(item, baseProduct, sourceUrl);
  }

  if (isAlpolicProductUrl(sourceUrl)) {
    return enrichAlpolicProduct(item, baseProduct);
  }

  if (isGlassManufacturerUrl(sourceUrl)) {
    return enrichGlassProduct(item, baseProduct);
  }

  return baseProduct;
}

function resolveIgnoredReason(
  item: CrawlerItem,
  context: ExtractionContext,
  sourceUrl: string,
): string {
  if (isNavigationOrInformationalPage(sourceUrl)) {
    return "navigation or informational page";
  }

  if (!isProductPageUrl(sourceUrl, context)) {
    return "non-product page";
  }

  const text = asString(item.text) ?? asString(item.markdown) ?? "";
  const rawTitle =
    asString(item.metadata?.title) ?? asString(item.title) ?? "";
  const productName = rawTitle
    ? extractProductName(item, rawTitle, context.manufacturer)
    : "";

  if (!productName) {
    return "missing product name";
  }

  const description = extractDescription(item, text);
  if (!isValidProductDescription(description)) {
    return "missing product description";
  }

  return "failed product quality checks";
}

function extractCrawlResults(
  rawItems: CrawlerItem[],
  context: ExtractionContext,
): {
  products: CrawledProduct[];
  ignoredPages: IgnoredPage[];
  discoveredProductUrls: string[];
} {
  const products: CrawledProduct[] = [];
  const ignoredPages: IgnoredPage[] = [];
  const discoveredProductUrls = new Set<string>();
  const seenIgnored = new Set<string>();

  for (const item of rawItems) {
    const sourceUrl = asString(item.url) ?? asString(item.loadedUrl);
    if (!sourceUrl) continue;

    if (isNavigationOrInformationalPage(sourceUrl)) {
      if (!seenIgnored.has(sourceUrl)) {
        ignoredPages.push({
          url: sourceUrl,
          reason: "navigation or informational page",
        });
        seenIgnored.add(sourceUrl);
      }
      continue;
    }

    if (!isProductPageUrl(sourceUrl, context)) {
      if (!seenIgnored.has(sourceUrl)) {
        ignoredPages.push({ url: sourceUrl, reason: "non-product page" });
        seenIgnored.add(sourceUrl);
      }
      continue;
    }

    discoveredProductUrls.add(sourceUrl);

    const product = mapCrawlerItemToProduct(item, context, { skipUrlCheck: true });
    if (!product) {
      if (!seenIgnored.has(sourceUrl)) {
        ignoredPages.push({
          url: sourceUrl,
          reason: resolveIgnoredReason(item, context, sourceUrl),
        });
        seenIgnored.add(sourceUrl);
      }
      continue;
    }

    products.push(product);
  }

  return {
    products,
    ignoredPages: ignoredPages.sort((left, right) => left.url.localeCompare(right.url)),
    discoveredProductUrls: Array.from(discoveredProductUrls).sort(),
  };
}

function collectCrawledUrls(rawItems: CrawlerItem[]): string[] {
  const urls = new Set<string>();

  for (const item of rawItems) {
    const sourceUrl = asString(item.url) ?? asString(item.loadedUrl);
    if (!sourceUrl) continue;
    urls.add(sourceUrl);
  }

  return Array.from(urls).sort();
}

const TERMINAL_RUN_STATUSES = new Set([
  "SUCCEEDED",
  "FAILED",
  "TIMED-OUT",
  "ABORTED",
]);

const EARLY_EXIT_CHECK_INTERVAL_MS = 8_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildCrawlerInput(
  startUrls: Array<{ url: string }>,
  maxPages: number,
  maxCrawlDepth: number,
  includeUrlGlobs: string[],
  excludeUrlGlobs: string[],
  crawlerType: "cheerio" | "playwright:chrome" | "playwright:adaptive" = "cheerio",
  proxyGroups?: string[],
): Record<string, unknown> {
  const proxyConfiguration: Record<string, unknown> = { useApifyProxy: true };
  if (proxyGroups && proxyGroups.length > 0) {
    proxyConfiguration.apifyProxyGroups = proxyGroups;
  }

  return {
    startUrls,
    crawlerType,
    includeUrlGlobs: includeUrlGlobs.map((glob) => ({ glob })),
    excludeUrlGlobs: excludeUrlGlobs.map((glob) => ({ glob })),
    maxCrawlPages: maxPages,
    maxCrawlDepth,
    maxConcurrency: crawlerType.startsWith("playwright") ? 8 : 15,
    dynamicContentWaitSecs: crawlerType.startsWith("playwright") ? 3 : 0,
    saveMarkdown: true,
    saveHtml: true,
    proxyConfiguration,
  };
}

async function waitForCrawlWithPolling(
  run: ApifyActorRun,
  options: {
    timeoutMs: number;
    pollIntervalMs: number;
    limit: number;
    earlyExitProductCount?: number;
    extractionContext: ExtractionContext;
    onCrawlPoll?: (update: { status: string; crawledPages: number }) => void | Promise<void>;
  },
): Promise<{
  run: ApifyActorRun;
  finished: boolean;
  earlyExit: boolean;
  earlyExitProductCount?: number;
  pollUpdates: Array<{
    polled_at: string;
    status: string;
    crawled_pages: number;
    crawl_urls: string[];
  }>;
}> {
  const deadline = Date.now() + options.timeoutMs;
  let currentRun = run;
  let finished = false;
  let earlyExit = false;
  let earlyExitProductCount: number | undefined;
  let lastEarlyCheck = 0;
  const pollUpdates: Array<{
    polled_at: string;
    status: string;
    crawled_pages: number;
    crawl_urls: string[];
  }> = [];

  const recordPollSnapshot = async (): Promise<void> => {
    const partialItems = await getDatasetItems<CrawlerItem>(
      currentRun.defaultDatasetId,
      { limit: options.limit },
    );
    pollUpdates.push({
      polled_at: new Date().toISOString(),
      status: currentRun.status,
      crawled_pages: partialItems.length,
      crawl_urls: collectCrawledUrls(partialItems),
    });

    await options.onCrawlPoll?.({
      status: currentRun.status,
      crawledPages: partialItems.length,
    });
  };

  await recordPollSnapshot();

  while (Date.now() < deadline) {
    if (TERMINAL_RUN_STATUSES.has(currentRun.status)) {
      finished = true;
      break;
    }

    if (
      options.earlyExitProductCount &&
      Date.now() - lastEarlyCheck >= EARLY_EXIT_CHECK_INTERVAL_MS
    ) {
      lastEarlyCheck = Date.now();
      const partialItems = await getDatasetItems<CrawlerItem>(
        currentRun.defaultDatasetId,
        { limit: options.limit },
      );
      const { products } = extractCrawlResults(
        partialItems,
        options.extractionContext,
      );

      if (products.length >= options.earlyExitProductCount) {
        earlyExit = true;
        earlyExitProductCount = products.length;
        break;
      }
    }

    await sleep(options.pollIntervalMs);
    currentRun = await getActorRun(run.id);
    await recordPollSnapshot();
  }

  if (!finished && !earlyExit) {
    currentRun = await getActorRun(run.id);
    finished = TERMINAL_RUN_STATUSES.has(currentRun.status);
    if (
      pollUpdates.length === 0 ||
      pollUpdates[pollUpdates.length - 1]?.status !== currentRun.status
    ) {
      await recordPollSnapshot();
    }
  }

  return { run: currentRun, finished, earlyExit, earlyExitProductCount, pollUpdates };
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

  const maxPages = options.maxPages ?? 50;
  const limit = options.limit ?? 50;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const pollIntervalMs = options.pollIntervalMs ?? 2_000;
  const maxCrawlDepth = options.maxCrawlDepth ?? 3;

  const includeUrlGlobs =
    options.includeUrlGlobs ?? buildDefaultIncludeGlobs(websiteUrl);
  const excludeUrlGlobs = buildExcludeGlobs(websiteUrl);

  const extractionContext: ExtractionContext = {
    manufacturer,
    brand: options.brand,
    category,
    productPagePattern: options.productPagePattern,
    productPageMatcher: options.productPageMatcher,
    websiteUrl,
  };

  let discoveredEntryUrls: string[] = [];
  if (options.entryUrls && options.entryUrls.length > 0) {
    discoveredEntryUrls = options.entryUrls;
    notes.push(
      `Using ${discoveredEntryUrls.length} predefined catalogue entry URL(s) to crawl.`,
    );
    if (
      manufacturer.toLowerCase().includes("saint") &&
      discoveredEntryUrls.some((url) => url.includes("saint-gobain-glass.com"))
    ) {
      notes.push(
        "Saint-Gobain .com entry URLs are included; UK mirror URLs are added because saint-gobain-glass.com is Cloudflare-protected.",
      );
    }
  } else if (!options.skipHomepageDiscovery && isHomepageUrl(websiteUrl)) {
    discoveredEntryUrls = await discoverHomepageEntryUrls(websiteUrl);
    if (discoveredEntryUrls.length > 0) {
      notes.push(
        `Homepage detected — discovered ${discoveredEntryUrls.length} product-section URL(s) to crawl.`,
      );
    } else {
      notes.push(
        "Homepage detected but no product-section links were found — crawling the homepage and linked pages.",
      );
    }
  }

  const startUrls = resolveCrawlerStartUrls(websiteUrl, discoveredEntryUrls);
  const crawlStartUrls = startUrls.map((entry) => entry.url);

  const actorInput = buildCrawlerInput(
    startUrls,
    maxPages,
    maxCrawlDepth,
    includeUrlGlobs,
    excludeUrlGlobs,
    options.crawlerType,
    options.proxyGroups,
  );
  const actorMemoryMbytes = resolveActorMemoryMbytes(options.crawlerType);

  // Print the exact actor input JSON before starting the actor (visible in dev server logs).
  console.info(
    `[import:${manufacturer}] Website Content Crawler input:\n${JSON.stringify(
      actorInput,
      null,
      2,
    )}`,
  );
  console.info(
    `[import:${manufacturer}] startUrls=${crawlStartUrls.length} maxCrawlPages=${maxPages} maxCrawlDepth=${maxCrawlDepth} includeUrlGlobs=${includeUrlGlobs.length} memoryMbytes=${actorMemoryMbytes}`,
  );

  const run = await startActorRun(WEBSITE_CONTENT_CRAWLER_ACTOR, actorInput, {
    memoryMbytes: actorMemoryMbytes,
  });

  const actorRunUrl = buildRunConsoleUrl(run);
  console.info(`[import:${manufacturer}] Actor run started: ${actorRunUrl}`);

  logImportSchedulerStage({
    stage: "apify_request_sent",
    manufacturer,
    runId: run.id,
    apifyStatus: run.status,
    detail: actorRunUrl,
  });

  let finalRun: ApifyActorRun = run;
  let finished = false;

  const waitResult = await waitForCrawlWithPolling(run, {
    timeoutMs,
    pollIntervalMs,
    limit,
    earlyExitProductCount: options.earlyExitProductCount,
    extractionContext,
    onCrawlPoll: options.onCrawlPoll,
  });
  finalRun = waitResult.run;
  finished = waitResult.finished;

  if (waitResult.pollUpdates.length > 0) {
    notes.push(
      `Recorded ${waitResult.pollUpdates.length} crawl status update(s) every ${pollIntervalMs / 1000}s.`,
    );
  }

  if (waitResult.earlyExit && waitResult.earlyExitProductCount) {
    notes.push(
      `Stopped crawl early after finding ${waitResult.earlyExitProductCount} valid product(s).`,
    );
  } else if (!waitResult.finished) {
    notes.push(
      `Crawl did not finish within ${timeoutMs}ms — returning partial results captured so far.`,
    );
  }

  const rawItems = await getDatasetItems<CrawlerItem>(finalRun.defaultDatasetId, {
    limit,
  });

  const crawlUrls = collectCrawledUrls(rawItems);
  const { products: extractedProducts, ignoredPages, discoveredProductUrls } =
    extractCrawlResults(rawItems, extractionContext);
  const products = await finalizeAlpolicProducts(extractedProducts, rawItems);

  if (ignoredPages.length > 0) {
    notes.push(
      `Ignored ${ignoredPages.length} page(s) — navigation, informational, or missing required product fields.`,
    );
  }

  if (finished && products.length === 0) {
    notes.push(
      discoveredProductUrls.length > 0
        ? `Crawl finished and found ${discoveredProductUrls.length} product URL(s), but none yielded extractable product data.`
        : "Crawl finished but no product pages matched the extraction rules. Try a more specific products URL or pass custom includeUrlGlobs.",
    );
  }

  // When nothing was crawled, pull the actor log so the caller can see why.
  let actorLogs: string | undefined;
  if (rawItems.length === 0) {
    notes.push(
      "Apify recorded 0 crawled pages — start URLs may be blocked or not match includeUrlGlobs. Verify catalogue URLs are reachable via the Apify proxy.",
    );
    actorLogs = await getActorRunLog(finalRun.id);
    console.warn(
      `[import:${manufacturer}] 0 pages crawled. Actor run: ${actorRunUrl}\n----- ACTOR LOG -----\n${actorLogs}\n----- END ACTOR LOG -----`,
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
    discovered_product_urls: discoveredProductUrls,
    discovered_entry_urls: discoveredEntryUrls,
    crawl_start_urls: crawlStartUrls,
    crawl_urls: crawlUrls,
    poll_updates: waitResult.pollUpdates,
    actor_input: actorInput,
    actor_run_url: actorRunUrl,
    actor_logs: actorLogs,
    ignored_pages: ignoredPages,
    products,
    notes,
  };
}
