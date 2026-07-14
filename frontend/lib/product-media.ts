const IMAGE_EXTENSION_PATTERN = /\.(?:jpg|jpeg|png|webp|avif|gif|svg)(?:\?[^\s")'<>]*)?$/i;
const PDF_EXTENSION_PATTERN = /\.pdf(?:\?[^\s")'<>]*)?$/i;

const LOGO_URL_PATTERN =
  /(?:^|[/_.-])(?:logo|logotype|brand-logo|site-logo|company-logo|favicon|apple-touch-icon|sprite|brandmark|brand-mark|header-logo|footer-logo|social-|partner-|avatar|badge|seal|watermark)(?:[/_.-]|$)/i;

const NON_PRODUCT_IMAGE_PATTERN =
  /(?:banner|hero-bg|background|stock-photo|placeholder|default-image|navigation|menu-|icon-|sprite|avatar|profile|map-|flag-|country-)/i;

const PRODUCT_IMAGE_HINT_PATTERN =
  /(?:product|bilder|buehnen|gallery|image-content|render|facade|panel|glass|material|sample|swatch|colour-series|color-series)/i;

export interface ProductMediaExtract {
  mainImageUrl?: string;
  galleryImages: string[];
  datasheetUrl?: string;
  brochureUrl?: string;
  installationGuideUrl?: string;
  technicalManualUrl?: string;
}

interface CrawlerMediaItem {
  url?: string;
  loadedUrl?: string;
  markdown?: string;
  html?: string;
  text?: string;
  metadata?: {
    openGraph?: Array<{ property?: string; content?: string }>;
    image?: string;
    [key: string]: unknown;
  };
}

type PdfKind = "datasheet" | "brochure" | "installationGuide" | "technicalManual";

const PDF_KIND_PATTERNS: Record<PdfKind, RegExp[]> = {
  datasheet: [
    /datasheet/i,
    /data-sheet/i,
    /data_sheet/i,
    /technical-data/i,
    /technical_data/i,
    /tds/i,
    /specification/i,
    /declaration/i,
    /performance/i,
  ],
  brochure: [/brochure/i, /catalog/i, /catalogue/i, /leaflet/i, /folder/i],
  installationGuide: [
    /installation/i,
    /install-guide/i,
    /install_guide/i,
    /installguide/i,
    /fitting/i,
    /mounting/i,
    /assembly/i,
  ],
  technicalManual: [
    /technical-manual/i,
    /technical_manual/i,
    /technicalmanual/i,
    /handbook/i,
    /user-manual/i,
    /user_manual/i,
  ],
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveAbsoluteUrl(url: string, baseUrl: string): string | undefined {
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return undefined;
  }
}

function normalizeMediaUrl(url: string): string | undefined {
  const trimmed = url.trim().replace(/&amp;/g, "&");
  if (!/^https?:\/\//i.test(trimmed)) return undefined;
  return trimmed;
}

function isImageUrl(url: string): boolean {
  return IMAGE_EXTENSION_PATTERN.test(url) || /\/image\//i.test(url);
}

function isPdfUrl(url: string): boolean {
  return PDF_EXTENSION_PATTERN.test(url);
}

function isLikelyLogoOrBrandAsset(url: string): boolean {
  const lower = url.toLowerCase();
  if (LOGO_URL_PATTERN.test(lower)) return true;
  if (NON_PRODUCT_IMAGE_PATTERN.test(lower)) return true;
  if (/\b(?:16x16|32x32|48x48|64x64|96x96|128x128|favicon)\b/i.test(lower)) return true;
  if (/\/(?:icons?|assets\/brand|brand\/|logos?)\//i.test(lower)) return true;
  return false;
}

function pagePathTokens(pageUrl: string): string[] {
  try {
    const pathname = new URL(pageUrl).pathname.toLowerCase();
    return pathname
      .split(/[/._-]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2);
  } catch {
    return [];
  }
}

function imageMatchesProductContext(url: string, pageUrl: string): boolean {
  if (isLikelyLogoOrBrandAsset(url)) return false;

  const lowerUrl = url.toLowerCase();
  if (PRODUCT_IMAGE_HINT_PATTERN.test(lowerUrl)) return true;

  const tokens = pagePathTokens(pageUrl);
  if (tokens.some((token) => lowerUrl.includes(token))) return true;

  try {
    const imageHost = new URL(url).hostname.replace(/^www\./, "");
    const pageHost = new URL(pageUrl).hostname.replace(/^www\./, "");
    if (imageHost !== pageHost) {
      return PRODUCT_IMAGE_HINT_PATTERN.test(lowerUrl);
    }
  } catch {
    return false;
  }

  return true;
}

function scoreProductImage(url: string, pageUrl: string): number {
  if (!imageMatchesProductContext(url, pageUrl)) return -1;

  let score = 0;
  const lower = url.toLowerCase();

  if (PRODUCT_IMAGE_HINT_PATTERN.test(lower)) score += 4;
  if (pagePathTokens(pageUrl).some((token) => lower.includes(token))) score += 3;
  if (/(?:large|hero|main|feature|buehnen|stage)/i.test(lower)) score += 2;
  if (/(?:thumb|thumbnail|small|icon)/i.test(lower)) score -= 2;

  return score;
}

function extractRawImageUrls(item: CrawlerMediaItem, pageUrl: string): string[] {
  const urls: string[] = [];

  const og = item.metadata?.openGraph?.find(
    (entry) => entry.property === "og:image" || entry.property === "image",
  );
  const fromMeta =
    asString(og?.content) ??
    asString(item.metadata?.image) ??
    asString(item.metadata && (item.metadata as Record<string, unknown>).imageUrl);

  if (fromMeta) {
    const resolved = resolveAbsoluteUrl(fromMeta, pageUrl);
    if (resolved) urls.push(resolved);
  }

  const html = item.html ?? "";
  for (const match of html.matchAll(
    /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi,
  )) {
    const resolved = resolveAbsoluteUrl(match[1], pageUrl);
    if (resolved) urls.push(resolved);
  }

  for (const match of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    const resolved = resolveAbsoluteUrl(match[1], pageUrl);
    if (resolved && isImageUrl(resolved)) urls.push(resolved);
  }

  const markdown = item.markdown ?? "";
  for (const match of markdown.matchAll(
    /!\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/gi,
  )) {
    const resolved = resolveAbsoluteUrl(match[1], pageUrl);
    if (resolved && isImageUrl(resolved)) urls.push(resolved);
  }

  const text = `${markdown}\n${html}\n${item.text ?? ""}`;
  for (const match of text.matchAll(
    /https?:\/\/[^\s")'<>]+\.(?:jpg|jpeg|png|webp|avif|gif)(?:\?[^\s")'<>]*)?/gi,
  )) {
    urls.push(match[0]);
  }

  return urls.map(normalizeMediaUrl).filter((url): url is string => Boolean(url));
}

interface PdfCandidate {
  url: string;
  context: string;
}

function classifyPdf(candidate: PdfCandidate): PdfKind | null {
  const haystack = `${candidate.url} ${candidate.context}`.toLowerCase();

  for (const kind of Object.keys(PDF_KIND_PATTERNS) as PdfKind[]) {
    if (PDF_KIND_PATTERNS[kind].some((pattern) => pattern.test(haystack))) {
      return kind;
    }
  }

  return null;
}

function extractPdfCandidates(item: CrawlerMediaItem, pageUrl: string): PdfCandidate[] {
  const source = `${item.markdown ?? ""}\n${item.html ?? ""}\n${item.text ?? ""}`;
  const candidates: PdfCandidate[] = [];

  for (const match of source.matchAll(
    /\[([^\]]*)\]\((https?:\/\/[^)\s]+\.pdf[^)\s]*)\)/gi,
  )) {
    candidates.push({ url: match[2], context: match[1] });
  }

  for (const match of source.matchAll(
    /href=["'](https?:\/\/[^"']+\.pdf[^"']*)["'][^>]*>([^<]*)</gi,
  )) {
    candidates.push({ url: match[1], context: match[2] });
  }

  for (const match of source.matchAll(/https?:\/\/[^\s")'<>]+\.pdf(?:\?[^\s")'<>]*)?/gi)) {
    candidates.push({ url: match[0], context: "" });
  }

  return candidates
    .map((candidate) => ({
      url: normalizeMediaUrl(resolveAbsoluteUrl(candidate.url, pageUrl) ?? candidate.url) ?? "",
      context: candidate.context,
    }))
    .filter((candidate) => candidate.url && isPdfUrl(candidate.url));
}

function pickBestPdf(
  candidates: PdfCandidate[],
  kind: PdfKind,
  assigned: Set<string>,
): string | undefined {
  for (const candidate of candidates) {
    if (assigned.has(candidate.url)) continue;
    if (classifyPdf(candidate) === kind) {
      assigned.add(candidate.url);
      return candidate.url;
    }
  }
  return undefined;
}

function uniqueUrls(urls: string[]): string[] {
  return Array.from(new Set(urls));
}

/** Extracts product media from a crawled page, excluding logos and non-product assets. */
export function extractProductMedia(
  item: CrawlerMediaItem,
  pageUrl: string,
): ProductMediaExtract {
  const rawImages = extractRawImageUrls(item, pageUrl);
  const scoredImages = uniqueUrls(rawImages)
    .map((url) => ({ url, score: scoreProductImage(url, pageUrl) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score);

  const galleryImages = scoredImages.map((entry) => entry.url);
  const mainImageUrl = galleryImages[0];

  const pdfCandidates = extractPdfCandidates(item, pageUrl);
  const assignedPdfs = new Set<string>();

  const datasheetUrl = pickBestPdf(pdfCandidates, "datasheet", assignedPdfs);
  const brochureUrl = pickBestPdf(pdfCandidates, "brochure", assignedPdfs);
  const installationGuideUrl = pickBestPdf(
    pdfCandidates,
    "installationGuide",
    assignedPdfs,
  );
  const technicalManualUrl = pickBestPdf(
    pdfCandidates,
    "technicalManual",
    assignedPdfs,
  );

  const fallbackDatasheet = pdfCandidates.find(
    (candidate) => !assignedPdfs.has(candidate.url),
  )?.url;

  return {
    mainImageUrl,
    galleryImages,
    datasheetUrl: datasheetUrl ?? fallbackDatasheet,
    brochureUrl,
    installationGuideUrl,
    technicalManualUrl,
  };
}
