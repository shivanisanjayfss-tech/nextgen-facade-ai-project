import {
  curateGalleryImageUrls,
  isExcludedGalleryImage,
} from "@/lib/product-image-url";
import {
  extractApplicationList,
  extractCertificationList,
  extractFeatureList,
} from "@/lib/spec-extraction";
import type { CrawledProduct } from "@/types/import";

const GLASS_MANUFACTURER_HOSTS = [
  "guardianglass.com",
  "agc-yourglass.com",
  "saint-gobain-glass.co.uk",
  "saint-gobain-glass.com",
] as const;

const FEATURE_ICON_FILENAME_PATTERN =
  /(?:energy-efficient|enhanced-security|enhanced-safety|solar-control|overheating|thermal-insulation|acoustic|noise-reduction|security|safety|favicon)/i;

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

function cleanInlineText(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Returns true for known glass manufacturer product URLs. */
export function isGlassManufacturerUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return GLASS_MANUFACTURER_HOSTS.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

/** Extracts full-size gallery URLs from WooCommerce product galleries. */
export function extractWooCommerceGalleryImages(html: string, pageUrl: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const galleryBlock =
    html.match(/woocommerce-product-gallery[\s\S]*?<\/div>\s*<\/div>/i)?.[0] ?? html;

  for (const match of galleryBlock.matchAll(/data-large_image=["']([^"']+)["']/gi)) {
    const resolved = resolveAbsoluteUrl(match[1], pageUrl);
    if (resolved && !seen.has(resolved)) {
      seen.add(resolved);
      urls.push(resolved);
    }
  }

  for (const match of galleryBlock.matchAll(
    /woocommerce-product-gallery__image[\s\S]*?<a href=["']([^"']+)["']/gi,
  )) {
    const resolved = resolveAbsoluteUrl(match[1], pageUrl);
    if (resolved && !seen.has(resolved) && !isExcludedGalleryImage(resolved)) {
      seen.add(resolved);
      urls.push(resolved);
    }
  }

  return urls;
}

/** Extracts feature titles from manufacturer icon-box benefit blocks (not their images). */
export function extractGlassBenefitFeatures(html: string): string[] {
  const features: string[] = [];
  const seen = new Set<string>();

  const contentScope =
    html.match(/class="[^"]*product-hero[^"]*"[\s\S]*?(?=woocommerce-product-gallery|<section)/i)?.[0] ??
    html.match(/class="[^"]*post_content[^"]*"[\s\S]*?(?=<section|$)/i)?.[0] ??
    html;

  for (const match of contentScope.matchAll(
    /<p class="w-iconbox-title"[^>]*>([^<]+)<\/p>/gi,
  )) {
    const title = cleanInlineText(match[1]);
    const key = title.toLowerCase();
    if (!title || seen.has(key)) continue;
    seen.add(key);
    features.push(title);
  }

  return features;
}

/** Maps performance-table column labels to canonical glass spec keys. */
function mapGlassPerformanceColumn(label: string): string | undefined {
  const normalized = label.toLowerCase();

  if (normalized.includes("light transmission") || normalized === "lt") {
    return "visibleLightTransmission";
  }
  if (normalized.includes("shgc") || normalized.includes("solar heat gain")) {
    return "shgc";
  }
  if (normalized.includes("solar factor") || normalized.includes("g-value") || normalized === "g value") {
    return "solarFactor";
  }
  if (normalized.includes("u value") || normalized.includes("u-value") || normalized.includes("w/m")) {
    return "uValue";
  }
  if (normalized.includes("reflectance") || normalized.includes("reflection")) {
    return "reflectance";
  }
  if (normalized.includes("emissivity")) {
    return "emissivity";
  }
  if (normalized.includes("selectivity")) {
    return "selectivity";
  }

  return undefined;
}

/** Extracts representative optical/thermal values from glass performance tables. */
export function extractGlassPerformanceTableSpecs(html: string): Record<string, string> {
  const specs: Record<string, string> = {};
  const tableMatch = html.match(
    /<table[^>]*class="[^"]*tablepress[^"]*"[^>]*>([\s\S]*?)<\/table>/i,
  );
  if (!tableMatch) return specs;

  const tableHtml = tableMatch[1];
  const headerRows = [...tableHtml.matchAll(/<thead[\s\S]*?<\/thead>/i)].flatMap((section) =>
    [...section[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) => row[1]),
  );

  const columnLabels: string[] = [];
  for (const rowHtml of headerRows) {
    const cells = [...rowHtml.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cell) =>
      cleanInlineText(cell[1]),
    );
    for (const [index, label] of cells.entries()) {
      if (!label) continue;
      columnLabels[index] = columnLabels[index] ? `${columnLabels[index]} ${label}` : label;
    }
  }

  const dataRow = tableHtml.match(/<tbody[\s\S]*?<tr[^>]*class="[^"]*row-3[^"]*"[^>]*>([\s\S]*?)<\/tr>/i)
    ?? tableHtml.match(/<tbody[\s\S]*?<tr[^>]*>([\s\S]*?)<\/tr>/i);
  if (!dataRow) return specs;

  const values = [...dataRow[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) =>
    cleanInlineText(cell[1]),
  );

  for (const [index, value] of values.entries()) {
    if (!value || !/[0-9]/.test(value)) continue;
    const label = columnLabels[index] ?? "";
    const key = mapGlassPerformanceColumn(label);
    if (!key || specs[key]) continue;

    if (key === "uValue") {
      specs[key] = `${value} W/m²K`;
    } else if (key === "visibleLightTransmission" || key === "reflectance") {
      specs[key] = `${value}%`;
    } else {
      specs[key] = value;
    }
  }

  return specs;
}

/** Extracts glass type and coating phrases from product-page prose. */
function extractGlassTypeAndCoating(text: string): {
  glassType?: string;
  coating?: string;
} {
  const result: { glassType?: string; coating?: string } = {};

  const glassTypeMatch = text.match(
    /\b((?:\w+[\s-]+){0,6}(?:coated|laminated|tempered|toughened|float|insulated|annealed|low[\s-]iron)[\w\s-]*glass)\b/i,
  );
  if (glassTypeMatch?.[1]) {
    result.glassType = glassTypeMatch[1].trim();
  }

  const coatingMatch = text.match(
    /\b((?:\w+[\s/-]+){0,4}(?:silver|pyrolytic|magnetron|sputtered|low[\s-]?e|solar control)[\w\s/-]*coat(?:ing|ed)?)\b/i,
  );
  if (coatingMatch?.[1]) {
    result.coating = coatingMatch[1].trim();
  }

  return result;
}

/** Extracts brochure, datasheet, installation, and maintenance PDFs from page links. */
function extractGlassDownloadUrls(
  item: CrawlerContentItem,
  pageUrl: string,
): Partial<
  Pick<
    CrawledProduct,
    | "datasheetUrl"
    | "brochureUrl"
    | "installationGuideUrl"
    | "technicalManualUrl"
    | "maintenanceGuideUrl"
  >
> {
  const source = `${item.markdown ?? ""}\n${item.html ?? ""}\n${item.text ?? ""}`;
  const downloads: Partial<
    Pick<
      CrawledProduct,
      | "datasheetUrl"
      | "brochureUrl"
      | "installationGuideUrl"
      | "technicalManualUrl"
      | "maintenanceGuideUrl"
    >
  > = {};

  for (const match of source.matchAll(/href=["']([^"']+\.pdf[^"']*)["'][^>]*>([\s\S]*?)<\//gi)) {
    const resolved = resolveAbsoluteUrl(match[1], pageUrl);
    if (!resolved) continue;

    const context = cleanInlineText(match[2]).toLowerCase();
    const filename = resolved.toLowerCase();

    if (!downloads.datasheetUrl && /datasheet|data-sheet|technical data|tds|specification/.test(`${context} ${filename}`)) {
      downloads.datasheetUrl = resolved;
      continue;
    }
    if (!downloads.brochureUrl && /brochure|catalogue|catalog|product guide|leaflet/.test(`${context} ${filename}`)) {
      downloads.brochureUrl = resolved;
      continue;
    }
    if (!downloads.installationGuideUrl && /installation|install guide|fitting|mounting|handling/.test(`${context} ${filename}`)) {
      downloads.installationGuideUrl = resolved;
      continue;
    }
    if (!downloads.technicalManualUrl && /technical manual|handbook|user manual/.test(`${context} ${filename}`)) {
      downloads.technicalManualUrl = resolved;
      continue;
    }
    if (!downloads.maintenanceGuideUrl && /maintenance|cleaning|care guide|processing/.test(`${context} ${filename}`)) {
      downloads.maintenanceGuideUrl = resolved;
    }
  }

  return downloads;
}

function isGlassFeatureIconImage(url: string): boolean {
  if (!/\.png(?:\?|$)/i.test(url)) return false;
  return FEATURE_ICON_FILENAME_PATTERN.test(url);
}

/** Applies glass-specific enrichment to a crawled product page. */
export function enrichGlassProduct(
  item: CrawlerContentItem,
  product: CrawledProduct,
): CrawledProduct {
  if (!isGlassManufacturerUrl(product.sourceUrl)) return product;

  const html = item.html ?? "";
  const text = `${item.text ?? ""}\n${item.markdown ?? ""}`.trim();
  const performanceSpecs = extractGlassPerformanceTableSpecs(html);
  const proseSpecs = extractGlassTypeAndCoating(text);
  const downloads = extractGlassDownloadUrls(item, product.sourceUrl);

  const features = [
    ...extractFeatureList(text, html),
    ...extractGlassBenefitFeatures(html),
  ].filter((value, index, array) => array.indexOf(value) === index);

  const applications = extractApplicationList(text, html);
  const certifications = extractCertificationList(text, html);

  const wooGallery = extractWooCommerceGalleryImages(html, product.sourceUrl);
  const curatedGallery = curateGalleryImageUrls(
    wooGallery.length > 0 ? wooGallery : (product.galleryImages ?? []),
  ).filter((url) => !isGlassFeatureIconImage(url));

  const heroImage =
    curatedGallery[0] ??
    (product.imageUrl && !isGlassFeatureIconImage(product.imageUrl)
      ? product.imageUrl
      : undefined);

  const technicalSpecs = {
    ...(product.technicalSpecs ?? {}),
    ...performanceSpecs,
    ...(proseSpecs.glassType ? { glassType: proseSpecs.glassType } : {}),
    ...(proseSpecs.coating && !product.technicalSpecs?.coating
      ? { coating: proseSpecs.coating }
      : {}),
  };

  return {
    ...product,
    imageUrl: heroImage ?? product.imageUrl,
    galleryImages: curatedGallery.length > 0 ? curatedGallery : product.galleryImages,
    features: features.length > 0 ? features : product.features,
    applications: applications.length > 0 ? applications : product.applications,
    certifications: certifications.length > 0 ? certifications : product.certifications,
    technicalSpecs: Object.keys(technicalSpecs).length > 0 ? technicalSpecs : product.technicalSpecs,
    uValue: performanceSpecs.uValue ?? product.uValue ?? product.technicalSpecs?.uValue,
    datasheetUrl: downloads.datasheetUrl ?? product.datasheetUrl,
    brochureUrl: downloads.brochureUrl ?? product.brochureUrl,
    installationGuideUrl: downloads.installationGuideUrl ?? product.installationGuideUrl,
    technicalManualUrl: downloads.technicalManualUrl ?? product.technicalManualUrl,
    maintenanceGuideUrl: downloads.maintenanceGuideUrl ?? product.maintenanceGuideUrl,
  };
}
