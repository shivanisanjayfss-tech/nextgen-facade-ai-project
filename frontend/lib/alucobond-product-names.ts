/** Canonical Alucobond product display names keyed by /by-brand/ URL slug. */
export const ALUCOBOND_SLUG_NAMES: Record<string, string> = {
  "alucobond-a2": "ALUCOBOND A2",
  "alucobond-plus": "ALUCOBOND PLUS",
  alucore: "ALUCORE",
  natural: "NaturAL",
  metallic: "Metallic",
  spectra: "Spectra",
  sparkling: "Sparkling",
  "anodized-look": "Anodized Look",
  "premium-anodised": "Premium Anodised",
  solid: "Solid",
  urban: "Urban",
  artenara: "Artenara",
  terra: "Terra",
};

const GENERIC_PRODUCT_NAME_PATTERNS = [
  /website\s*\(/i,
  /\bwebsite\b/i,
  /\b(?:home\s*page?|homepage)\b/i,
  /\bhome\b/i,
  /gmbh\s+website/i,
  /^3a\s+composites(?:\s+gmbh)?(?:\s+website)?/i,
  /3a\s+composites\s+gmbh\s+website/i,
  /official\s+website/i,
  /^welcome(?:\s+to)?\b/i,
  /\|\s*3a\s+composites/i,
  /^\s*3a\s+composites\s*$/i,
  /\bcompany\b/i,
] as const;

/** Returns true when a name is a site-level title, not a product name. */
export function isGenericProductName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 3) return true;
  return GENERIC_PRODUCT_NAME_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** Resolves an Alucobond product name from a /by-brand/ catalogue URL. */
export function resolveAlucobondProductNameFromUrl(url: string): string | undefined {
  const colourSeriesMatch = url.match(/\/by-colour-series\/([^/?#]+)/i);
  if (colourSeriesMatch?.[1]) {
    const slug = colourSeriesMatch[1].trim().toLowerCase();
    if (ALUCOBOND_SLUG_NAMES[slug]) return ALUCOBOND_SLUG_NAMES[slug];
    return titleCaseSlug(slug);
  }

  const match = url.match(/\/by-brand\/([^/?#]+)/i);
  if (!match?.[1]) return undefined;

  const slug = match[1].trim().toLowerCase();
  if (ALUCOBOND_SLUG_NAMES[slug]) return ALUCOBOND_SLUG_NAMES[slug];

  const parts = slug.split("-").filter(Boolean);
  if (parts.length === 0) return undefined;

  if (parts[0] === "alucobond") {
    const suffix = parts.slice(1).join(" ").toUpperCase();
    return suffix ? `ALUCOBOND ${suffix}` : "ALUCOBOND";
  }

  return titleCaseSlug(slug);
}

/** Returns true when a material row looks like an Alucobond import candidate. */
export function isAlucobondSourceUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /alucobond\.com\/.*\/by-(?:brand|colour-series)\//i.test(url);
}
