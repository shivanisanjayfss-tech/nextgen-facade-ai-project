import { curateGalleryImageUrls } from "@/lib/product-image-url";
import type { CrawledProduct } from "@/types/import";

export const ALPOLIC_BASE = "https://www.alpolic.com";
export const ALPOLIC_CATALOGUE_URL = `${ALPOLIC_BASE}/alpolic-intl/`;
export const ALPOLIC_DOWNLOADS_URL = `${ALPOLIC_BASE}/alpolic-intl/downloads/`;

/** Verified product-page entry points on alpolic.com. */
export const ALPOLIC_ENTRY_URLS = [
  `${ALPOLIC_BASE}/alpolic-intl/product_fr/`,
  `${ALPOLIC_BASE}/alpolic-intl/product_a2/`,
  ALPOLIC_DOWNLOADS_URL,
] as const;

/** Maps Alpolic URL path segments to stable catalogue slugs. */
const ALPOLIC_SLUG_BY_SEGMENT: Record<string, string> = {
  product_fr: "alpolic-fr",
  product_a2: "alpolic-a2",
  product_frlt: "alpolic-fr-lt",
  "product_fr-rf": "alpolic-fr-rf",
  product_alpolic: "alpolic",
  product_alleader: "al-leader",
  product_cm: "alpolic-tcm-scm",
};

/** Display names keyed by URL path segment. */
const ALPOLIC_NAME_BY_SEGMENT: Record<string, string> = {
  product_fr: "Alpolic FR",
  product_a2: "Alpolic A2",
  product_frlt: "Alpolic FR LT",
  "product_fr-rf": "Alpolic FR-RF",
  product_alpolic: "Alpolic",
  product_alleader: "AL-LEADER",
  product_cm: "Alpolic TCM, SCM, ZCM",
};

const ALPOLIC_NAV_SLUGS = new Set([
  "alpolic-intl",
  "downloads",
  "contact",
  "about",
  "news",
  "example-projects",
  "purchasing_orders",
]);

const COLOR_CHART_PATTERN = /color[\s_-]*chart|colour[\s_-]*chart/i;
const DIAGRAM_IMAGE_PATTERN = /(?:^|[/_.-])insert\d|(?:^|[/_.-])tmp-|footer-image|tmp-logo/i;

/** Returns true for Mitsubishi Chemical Alpolic product URLs. */
export function isAlpolicProductUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("alpolic.com")) return false;
    return /\/alpolic-intl\/product_/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

/** Extracts the product path segment from an Alpolic URL (e.g. product_fr). */
export function resolveAlpolicPathSegment(url: string): string | undefined {
  const match = url.match(/\/alpolic-intl\/(product_[^/?#]+)/i);
  return match?.[1]?.toLowerCase();
}

/** Resolves the catalogue slug for an Alpolic product URL. */
export function resolveAlpolicSlug(url: string): string | undefined {
  const segment = resolveAlpolicPathSegment(url);
  if (!segment) return undefined;
  return ALPOLIC_SLUG_BY_SEGMENT[segment] ?? segment.replace(/^product_/, "alpolic-");
}

/** Resolves the display product name for an Alpolic product URL. */
export function resolveAlpolicProductName(url: string, fallback?: string): string | undefined {
  const segment = resolveAlpolicPathSegment(url);
  if (segment && ALPOLIC_NAME_BY_SEGMENT[segment]) {
    return ALPOLIC_NAME_BY_SEGMENT[segment];
  }
  return fallback;
}

/** Returns true for Alpolic catalogue/navigation pages (not individual products). */
export function isAlpolicNavigationPage(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.replace(/\/$/, "").toLowerCase();
    const segment = pathname.split("/").filter(Boolean).pop() ?? "";
    return ALPOLIC_NAV_SLUGS.has(segment);
  } catch {
    return false;
  }
}

interface CrawlerContentItem {
  markdown?: string;
  html?: string;
  text?: string;
}

function resolveAbsoluteUrl(url: string, baseUrl: string): string | undefined {
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return undefined;
  }
}

/** Maps an Alpolic product URL segment to the downloads-page spec-sheet lookup key. */
export function resolveAlpolicSpecSheetKey(segment: string): string {
  return segment.replace(/^product_/, "").replace(/-/g, "").toLowerCase();
}

/** Derives a spec-sheet lookup key from a specs_*.pdf filename. */
function specSheetKeyFromFilename(filename: string): string | undefined {
  const base = filename.replace(/^specs_/i, "").replace(/\.pdf$/i, "");
  const normalized = base.replace(/^alpolic/i, "").toLowerCase();
  return normalized || undefined;
}

/** Indexes specification PDF URLs from Alpolic downloads/product page HTML. */
export function indexAlpolicSpecSheets(
  source: string,
  pageUrl: string,
): Map<string, string> {
  const specSheets = new Map<string, string>();

  for (const match of source.matchAll(/href=["']([^"']*specs_[^"']+\.pdf)["']/gi)) {
    const resolved = resolveAbsoluteUrl(match[1], pageUrl);
    if (!resolved) continue;

    const filename = match[1].split("/").pop() ?? "";
    const key = specSheetKeyFromFilename(filename);
    if (key) specSheets.set(key, resolved);
  }

  for (const match of source.matchAll(/https?:\/\/[^\s"')<>]*\/specs_[^\s"')<>]+\.pdf/gi)) {
    const resolved = match[0];
    const filename = resolved.split("/").pop() ?? "";
    const key = specSheetKeyFromFilename(filename);
    if (key) specSheets.set(key, resolved);
  }

  return specSheets;
}

/** Fetches the Alpolic downloads page and indexes linked specification PDFs. */
export async function fetchAlpolicSpecSheetIndex(): Promise<Map<string, string>> {
  try {
    const response = await fetch(ALPOLIC_DOWNLOADS_URL, {
      headers: { Accept: "text/html" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return new Map();
    const html = await response.text();
    return indexAlpolicSpecSheets(html, ALPOLIC_DOWNLOADS_URL);
  } catch {
    return new Map();
  }
}

function isAlpolicSpecDatasheet(url: string | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes("/specs_") && !COLOR_CHART_PATTERN.test(lower);
}

function isNonProductAlpolicImage(url: string): boolean {
  const lower = url.toLowerCase();
  if (DIAGRAM_IMAGE_PATTERN.test(lower)) return true;
  if (LOGO_OR_CHART_PATTERN.test(lower)) return true;
  return false;
}

const LOGO_OR_CHART_PATTERN = /(?:logo|footer-image|tmp-logo|color[\s_-]*chart)/i;

/** Picks the best hero image from an Alpolic product page. */
function resolveAlpolicHeroImage(item: CrawlerContentItem, pageUrl: string): string | undefined {
  const html = item.html ?? "";
  const candidates: string[] = [];

  const headerMatch = html.match(
    /entry-header[^>]*style=["'][^"']*background-image:\s*url\(['"]?([^'")]+)['"]?\)/i,
  );
  if (headerMatch?.[1]) {
    const resolved = resolveAbsoluteUrl(headerMatch[1], pageUrl);
    if (resolved) candidates.push(resolved);
  }

  for (const match of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    const resolved = resolveAbsoluteUrl(match[1], pageUrl);
    if (resolved) candidates.push(resolved);
  }

  for (const url of candidates) {
    if (!isNonProductAlpolicImage(url)) return url;
  }

  return undefined;
}

function reorderAlpolicGallery(heroImage: string | undefined, gallery: string[] | undefined): string[] {
  const filtered = (gallery ?? []).filter((url) => !isNonProductAlpolicImage(url));
  return curateGalleryImageUrls(filtered, { preferredFirst: heroImage });
}

function cleanInlineText(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Extracts feature statements from Alpolic product-page prose. */
function extractAlpolicFeatures(item: CrawlerContentItem): string[] {
  const html = item.html ?? "";
  const text = item.text ?? item.markdown ?? "";
  const features: string[] = [];
  const seen = new Set<string>();

  const introMatch = html.match(/<p>\s*<img[^>]+>\s*([^<]+(?:<[^>]+>[^<]*)*?)<\/p>/i);
  const intro = cleanInlineText(introMatch?.[1] ?? text.split("\n").find((line) => line.length > 40) ?? "");

  for (const sentence of intro.split(/(?<=[.!?])\s+/)) {
    const cleaned = cleanInlineText(sentence);
    if (cleaned.length < 20 || cleaned.length > 180) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    features.push(cleaned);
    if (features.length >= 6) break;
  }

  return features;
}

/** Extracts application areas mentioned on an Alpolic product page. */
function extractAlpolicApplications(item: CrawlerContentItem): string[] {
  const haystack = `${item.html ?? ""}\n${item.text ?? ""}\n${item.markdown ?? ""}`.toLowerCase();
  const applications: string[] = [];

  if (/\bexterior\b/.test(haystack)) applications.push("Exterior cladding");
  if (/\binterior\b/.test(haystack)) applications.push("Interior cladding");
  if (/\broof(?:ing)?\b/.test(haystack)) applications.push("Roof covering");
  if (/\bsignage\b/.test(haystack)) applications.push("Signage");

  return applications;
}

/** Extracts certification / compliance statements from Alpolic product pages. */
function extractAlpolicCertifications(item: CrawlerContentItem): string[] {
  const haystack = `${item.text ?? ""}\n${item.markdown ?? ""}`;
  const certifications: string[] = [];
  const seen = new Set<string>();

  for (const match of haystack.matchAll(
    /\b([A-F][12](?:-s[0-3])?(?:,?\s?d[0-2])?(?:\s*\(EN\s*13501-1\))?)\b/gi,
  )) {
    const value = match[1].trim();
    if (value.length < 3) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    certifications.push(value);
  }

  if (/fire[\s-]*safety\s+code/i.test(haystack)) {
    certifications.push("Fire-safety code compliant");
  }

  return certifications;
}

function resolvePanelThickness(product: CrawledProduct): string | undefined {
  const fromSpecs = product.technicalSpecs?.thickness?.trim();
  if (fromSpecs && !/^0\.5\s*mm$/i.test(fromSpecs)) return fromSpecs;
  return undefined;
}

/** Attaches specification PDFs from an indexed downloads-page map. */
export function attachAlpolicSpecSheetsToProducts(
  products: CrawledProduct[],
  specSheets: Map<string, string>,
): CrawledProduct[] {
  if (specSheets.size === 0) return products;

  return products.map((product) => {
    if (!isAlpolicProductUrl(product.sourceUrl)) return product;

    const segment = resolveAlpolicPathSegment(product.sourceUrl);
    if (!segment) return product;

    const key = resolveAlpolicSpecSheetKey(segment);
    const datasheet = specSheets.get(key);
    if (!datasheet) return product;

    if (isAlpolicSpecDatasheet(product.datasheetUrl)) return product;

    return { ...product, datasheetUrl: datasheet };
  });
}

/** Indexes specification PDFs from crawled pages and attaches them to Alpolic products. */
export function attachAlpolicDatasheetsFromCrawl<T extends CrawlerContentItem & { url?: string; loadedUrl?: string }>(
  products: CrawledProduct[],
  rawItems: T[],
): CrawledProduct[] {
  if (!products.some((product) => isAlpolicProductUrl(product.sourceUrl))) {
    return products;
  }

  const specSheets = new Map<string, string>();

  for (const item of rawItems) {
    const pageUrl = item.url ?? item.loadedUrl ?? ALPOLIC_BASE;
    const source = `${item.markdown ?? ""}\n${item.html ?? ""}\n${item.text ?? ""}`;
    for (const [key, url] of indexAlpolicSpecSheets(source, pageUrl)) {
      specSheets.set(key, url);
    }
  }

  return attachAlpolicSpecSheetsToProducts(products, specSheets);
}

/** Applies Alpolic-specific enrichment to a crawled product. */
export function enrichAlpolicProduct(
  item: CrawlerContentItem,
  product: CrawledProduct,
): CrawledProduct {
  if (!isAlpolicProductUrl(product.sourceUrl)) return product;

  const segment = resolveAlpolicPathSegment(product.sourceUrl);
  const productName =
    resolveAlpolicProductName(product.sourceUrl, product.productName) ?? product.productName;
  const heroImage = resolveAlpolicHeroImage(item, product.sourceUrl);
  const galleryImages = reorderAlpolicGallery(heroImage, product.galleryImages);
  const panelThickness = resolvePanelThickness(product);
  const features = product.features?.length ? product.features : extractAlpolicFeatures(item);
  const applications = product.applications?.length
    ? product.applications
    : extractAlpolicApplications(item);
  const certifications = extractAlpolicCertifications(item);

  let datasheetUrl = product.datasheetUrl;
  if (!isAlpolicSpecDatasheet(datasheetUrl)) {
    const fromPage = indexAlpolicSpecSheets(
      `${item.markdown ?? ""}\n${item.html ?? ""}\n${item.text ?? ""}`,
      product.sourceUrl,
    );
    const key = segment ? resolveAlpolicSpecSheetKey(segment) : undefined;
    datasheetUrl = (key && fromPage.get(key)) || datasheetUrl;
  }

  if (COLOR_CHART_PATTERN.test(datasheetUrl ?? "")) {
    datasheetUrl = undefined;
  }

  const technicalSpecs = product.technicalSpecs ?? {};

  return {
    ...product,
    productName,
    manufacturer: "Mitsubishi Chemical",
    brand: "ALPOLIC",
    productFamily: "ALPOLIC",
    productType: product.productType ?? "Product",
    imageUrl: heroImage ?? product.imageUrl,
    galleryImages: galleryImages.length > 0 ? galleryImages : product.galleryImages,
    thickness: panelThickness ?? product.thickness,
    features: features.length > 0 ? features : product.features,
    applications: applications.length > 0 ? applications : product.applications,
    certifications: certifications.length > 0 ? certifications : product.certifications,
    technicalSpecs: Object.keys(technicalSpecs).length > 0 ? technicalSpecs : product.technicalSpecs,
    datasheetUrl,
    brochureUrl: product.brochureUrl,
  };
}

/** Ensures Alpolic products have spec-sheet datasheets from crawl data or the downloads page. */
export async function finalizeAlpolicProducts<T extends CrawlerContentItem & { url?: string; loadedUrl?: string }>(
  products: CrawledProduct[],
  rawItems: T[],
): Promise<CrawledProduct[]> {
  let finalized = attachAlpolicDatasheetsFromCrawl(products, rawItems);

  const needsDownloadsLookup = finalized.some(
    (product) =>
      isAlpolicProductUrl(product.sourceUrl) && !isAlpolicSpecDatasheet(product.datasheetUrl),
  );

  if (needsDownloadsLookup) {
    const specSheets = await fetchAlpolicSpecSheetIndex();
    finalized = attachAlpolicSpecSheetsToProducts(finalized, specSheets);
  }

  return finalized;
}
