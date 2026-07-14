import { ALUCOBOND_SLUG_NAMES } from "@/lib/alucobond-product-names";
import type { CrawledProduct } from "@/types/import";

export type AlucobondPageType = "product" | "product-family" | "colour-series" | "unknown";

/** Slugs for Alucobond colour-series catalogue pages. */
export const ALUCOBOND_COLOUR_SERIES_SLUGS = new Set([
  "urban",
  "metallic",
  "natural",
  "spectra",
  "sparkling",
  "solid",
  "artenara",
  "anodized-look",
  "premium-anodised",
  "terra",
]);

/** Brand product slugs that can act as shared specification parents. */
export const ALUCOBOND_BRAND_PARENT_SLUGS = {
  plus: "alucobond-plus",
  a2: "alucobond-a2",
  alucore: "alucore",
} as const;

const INHERITABLE_SPEC_FIELDS = [
  "fireRating",
  "thickness",
  "dimensions",
  "warranty",
  "coreMaterial",
  "weight",
  "panelWeight",
  "thermalConductivity",
  "windLoad",
  "uValue",
] as const;

interface CrawlerContentItem {
  markdown?: string;
  html?: string;
  text?: string;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** Detects whether an Alucobond URL is a brand, family, or colour-series page. */
export function detectAlucobondPageType(url: string): AlucobondPageType {
  if (/\/by-colour-series\//i.test(url)) return "colour-series";
  if (/\/by-brand\//i.test(url)) return "product";
  if (/\/product-family\//i.test(url)) return "product-family";
  return "unknown";
}

/** Returns true for Alucobond colour-series product URLs. */
export function isAlucobondColourSeriesUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return detectAlucobondPageType(url) === "colour-series";
}

/** Returns true for Alucobond brand product URLs under /by-brand/. */
export function isAlucobondBrandProductUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return detectAlucobondPageType(url) === "product";
}

/** Extracts the colour-series slug from an Alucobond URL. */
export function resolveAlucobondColourSeriesSlug(url: string): string | undefined {
  const match = url.match(/\/by-colour-series\/([^/?#]+)/i);
  return match?.[1]?.trim().toLowerCase();
}

/** Resolves the display name for a colour-series page from its URL. */
export function resolveAlucobondColourSeriesNameFromUrl(url: string): string | undefined {
  const slug = resolveAlucobondColourSeriesSlug(url);
  if (!slug) return undefined;
  if (ALUCOBOND_SLUG_NAMES[slug]) return ALUCOBOND_SLUG_NAMES[slug];
  return titleCaseSlug(slug);
}

/** Chooses which brand product should supply inherited specifications. */
export function resolveAlucobondParentSlug(
  sourceUrl: string,
  haystack = "",
): string {
  if (/\ba2\b/i.test(haystack) && !/\bplus\b/i.test(haystack)) {
    return ALUCOBOND_BRAND_PARENT_SLUGS.a2;
  }

  if (/\balucore\b/i.test(haystack)) {
    return ALUCOBOND_BRAND_PARENT_SLUGS.alucore;
  }

  return ALUCOBOND_BRAND_PARENT_SLUGS.plus;
}

function extractColourSeriesLead(item: CrawlerContentItem): string | undefined {
  const markdown = item.markdown ?? "";
  const html = item.html ?? "";

  const markdownMatch = markdown.match(/^#\s+[^\n]+\n+##\s+(.+?)(?:\n\n|\n#{1,3}\s)/ims);
  if (markdownMatch?.[1]) {
    return markdownMatch[1].replace(/\s+/g, " ").trim();
  }

  const htmlMatch = html.match(/<h1[^>]*>[\s\S]*?<\/h1>\s*<h2[^>]*>([\s\S]*?)<\/h2>/i);
  if (htmlMatch?.[1]) {
    return htmlMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  return undefined;
}

function extractColourSeriesBullets(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s+/, "").trim())
    .filter((line) => line.length > 8 && line.length < 180)
    .slice(0, 4);
}

/** Extracts colour tone names from a colour-series page. */
export function extractAlucobondColourTones(item: CrawlerContentItem): string[] {
  const source = `${item.markdown ?? ""}\n${item.html ?? ""}\n${item.text ?? ""}`;
  const tones = new Set<string>();

  for (const match of source.matchAll(/colour\s+tone\s*:\s*([^\n<]+)/gi)) {
    const tone = match[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (tone) tones.add(tone);
  }

  return Array.from(tones);
}

function extractFinish(text: string, seriesName: string): string | undefined {
  const explicit = text.match(/finish\s*[:\-]\s*([^\n.]+)/i)?.[1]?.trim();
  if (explicit) return explicit;

  if (/metallic sheen|metallic finish/i.test(text)) return "Metallic";
  if (/anodiz/i.test(seriesName) || /anodiz/i.test(text)) return "Anodised";
  if (/natural\b/i.test(seriesName)) return "Natural";
  if (/spectra/i.test(seriesName)) return "Spectra";
  if (/sparkl/i.test(seriesName)) return "Sparkling";
  if (/solid\b/i.test(seriesName)) return "Solid";
  if (/urban/i.test(seriesName)) return "Urban";
  if (/terra/i.test(seriesName)) return "Terra";
  if (/artenara/i.test(seriesName)) return "Artenara";

  return undefined;
}

function extractSurface(text: string): string | undefined {
  return text.match(/surface\s*[:\-]\s*([^\n.]+)/i)?.[1]?.trim();
}

/** Builds a consultant-friendly description for a colour-series page. */
export function buildAlucobondColourSeriesDescription(
  item: CrawlerContentItem,
  seriesName: string,
  fallbackDescription?: string,
): string {
  const text = asString(item.text) ?? asString(item.markdown) ?? "";
  const lead = extractColourSeriesLead(item);
  const bullets = extractColourSeriesBullets(text);

  const parts = [
    lead,
    bullets.length > 0 ? bullets.join(" ") : undefined,
  ].filter((part): part is string => Boolean(part));

  if (parts.length > 0) {
    return parts.join(" ").trim();
  }

  if (fallbackDescription) {
    return fallbackDescription
      .replace(
        new RegExp(`^${seriesName}\\s*\\|\\s*3A Composites.*?(?:➞|$)`, "i"),
        "",
      )
      .replace(/\s*➞.*$/, "")
      .trim();
  }

  return `${seriesName} colour series from ALUCOBOND aluminium composite panels.`;
}

/** Applies colour-series enrichment to a crawled Alucobond product. */
export function enrichAlucobondColourSeriesProduct(
  item: CrawlerContentItem,
  product: CrawledProduct,
): CrawledProduct {
  const seriesName =
    resolveAlucobondColourSeriesNameFromUrl(product.sourceUrl) ?? product.productName;
  const text = `${item.markdown ?? ""}\n${item.text ?? ""}`;
  const availableColours = extractAlucobondColourTones(item);
  const finish = extractFinish(text, seriesName);
  const surface = extractSurface(text);
  const parentSlug = resolveAlucobondParentSlug(product.sourceUrl, text);

  return {
    ...product,
    productName: seriesName,
    description: buildAlucobondColourSeriesDescription(item, seriesName, product.description),
    colourSeriesName: seriesName,
    productFamily: "ALUCOBOND",
    finish,
    surface,
    availableColours: availableColours.length > 0 ? availableColours : undefined,
    inheritSpecsFromSlug: parentSlug,
    pageType: "colour-series",
  };
}

/** Copies missing specification fields from a parent brand product. */
export function applyInheritedSpecs(
  product: CrawledProduct,
  parentSpecs: Record<string, unknown>,
  parentDownloads?: { datasheetUrl?: string | null; brochureUrl?: string | null },
): CrawledProduct {
  const enriched: CrawledProduct = { ...product };

  if (!enriched.fireRating && parentSpecs.fireRating) {
    enriched.fireRating = String(parentSpecs.fireRating);
  }
  if (!enriched.thickness && parentSpecs.thickness) {
    enriched.thickness = String(parentSpecs.thickness);
  }
  if (!enriched.dimensions && parentSpecs.dimensions) {
    enriched.dimensions = String(parentSpecs.dimensions);
  }
  if (!enriched.warranty && parentSpecs.warranty) {
    enriched.warranty = String(parentSpecs.warranty);
  }
  if (!enriched.coreMaterial && parentSpecs.coreMaterial) {
    enriched.coreMaterial = String(parentSpecs.coreMaterial);
  }
  if (!enriched.weight && parentSpecs.weight) {
    enriched.weight = String(parentSpecs.weight);
  }
  if (!enriched.panelWeight && parentSpecs.panelWeight) {
    enriched.panelWeight = String(parentSpecs.panelWeight);
  }
  if (!enriched.thermalConductivity && parentSpecs.thermalConductivity) {
    enriched.thermalConductivity = String(parentSpecs.thermalConductivity);
  }
  if (!enriched.windLoad && parentSpecs.windLoad) {
    enriched.windLoad = String(parentSpecs.windLoad);
  }
  if (!enriched.uValue && parentSpecs.uValue) {
    enriched.uValue = String(parentSpecs.uValue);
  }

  if (!enriched.datasheetUrl && parentDownloads?.datasheetUrl) {
    enriched.datasheetUrl = parentDownloads.datasheetUrl;
  }
  if (!enriched.brochureUrl && parentSpecs.brochureUrl) {
    enriched.brochureUrl = String(parentSpecs.brochureUrl);
  } else if (!enriched.brochureUrl && parentDownloads?.brochureUrl) {
    enriched.brochureUrl = parentDownloads.brochureUrl;
  }

  enriched.inheritedSpecsFrom = product.inheritSpecsFromSlug;
  return enriched;
}

/** Returns spec keys that may be inherited from a parent brand product. */
export function getInheritableSpecFields(): readonly string[] {
  return INHERITABLE_SPEC_FIELDS;
}
