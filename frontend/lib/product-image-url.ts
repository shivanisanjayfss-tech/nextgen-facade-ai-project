/** Remote hosts allowed for next/image optimization. */
export const PRODUCT_IMAGE_REMOTE_HOSTS = [
  "alucobond.com",
  "www.alucobond.com",
  "guardianglass.com",
  "www.guardianglass.com",
  "agc-yourglass.com",
  "www.agc-yourglass.com",
  "saint-gobain-glass.com",
  "www.saint-gobain-glass.com",
  "saint-gobain-glass.co.uk",
  "www.saint-gobain-glass.co.uk",
] as const;

const OPTIMIZABLE_HOSTS = new Set(
  PRODUCT_IMAGE_REMOTE_HOSTS.map((host) => host.toLowerCase()),
);

function isLocalAppAssetPath(value: string): boolean {
  return (
    value.startsWith("/datasheets/") ||
    value.startsWith("/files/") ||
    value.startsWith("/images/") ||
    value.startsWith("/_next/") ||
    value.startsWith("/api/")
  );
}

/** Normalizes product image URLs stored during import and at display time. */
export function normalizeProductImageUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("//")) {
    return normalizeProductImageUrl(`https:${trimmed}`);
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();

    if (host === "alucobond.com" || host === "www.alucobond.com") {
      const rootAssetPath = url.pathname.match(/\/((?:assets|files)\/images\/.+)$/i)?.[1];
      if (rootAssetPath) {
        return `https://www.alucobond.com/${rootAssetPath}`;
      }
    }
  } catch {
    return isLocalAppAssetPath(trimmed) ? trimmed : null;
  }

  return isHttpImageUrl(trimmed) || isLocalAppAssetPath(trimmed) ? trimmed : null;
}

/**
 * Resolves a possibly relative image URL against a product or manufacturer page URL.
 */
export function resolveRelativeProductImageUrl(
  value: string | null | undefined,
  baseUrl?: string | null,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const direct = normalizeProductImageUrl(trimmed);
  if (direct) return direct;

  if (!baseUrl?.trim()) return null;

  try {
    return normalizeProductImageUrl(new URL(trimmed, baseUrl.trim()).href);
  } catch {
    return null;
  }
}

function isHttpImageUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/** Returns true when the URL can be rendered through next/image remotePatterns. */
export function isOptimizableRemoteImage(value: string): boolean {
  if (!isHttpImageUrl(value)) return false;

  try {
    const { protocol, hostname } = new URL(value);
    if (protocol !== "https:" && protocol !== "http:") return false;
    return OPTIMIZABLE_HOSTS.has(hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Resolves a Supabase imageUrl for display, or null when unusable. */
export function resolveProductImageUrl(value: string | null | undefined): string | null {
  return normalizeProductImageUrl(value);
}

/** Maximum gallery images stored per imported product. */
export const MAX_GALLERY_IMAGES = 6;

const GALLERY_LOGO_PATTERN =
  /(?:^|[/_.-])(?:logo|logotype|brand-logo|site-logo|company-logo|favicon|apple-touch-icon|sprite|brandmark|brand-mark|header-logo|footer-logo|social-|partner-|avatar|badge|seal|watermark|tmp-logo)(?:[/_.-]|$)/i;

const GALLERY_ICON_PATTERN =
  /(?:^|[/_.-])(?:icon|icons|sprite|avatar|profile|emoji|picto|glyph)(?:[/_.-]|$)|\/(?:icons?|sprites?|assets\/brand|brand\/|logos?)\//i;

const GALLERY_THUMBNAIL_PATTERN =
  /(?:^|[/_.-])(?:thumb(?:nail)?s?|thumbs|small|mini|preview|lowres|low-res)(?:[/_.-]|$)|-\d{1,4}x\d{1,4}(?=\.[^./]+$)/i;

const GALLERY_NON_PRODUCT_PATTERN =
  /(?:banner|hero-bg|background|stock-photo|placeholder|default-image|navigation|menu-|map-|flag-|country-|footer-image)/i;

const GALLERY_FEATURE_ICON_PATTERN =
  /(?:energy-efficient|enhanced-security|enhanced-safety|solar-control|overheating|thermal-insulation|acoustic|noise-reduction|favicon)/i;

const GALLERY_DIMENSION_SUFFIX_PATTERN = /-(\d{1,4})x(\d{1,4})(?=\.[^./]+$)/i;

interface CurateGalleryOptions {
  max?: number;
  /** Keeps this image first when it passes gallery filters. */
  preferredFirst?: string | null;
}

/** Returns true for logos, icons, thumbnails, and other non-gallery assets. */
export function isExcludedGalleryImage(url: string): boolean {
  const lower = url.toLowerCase();

  if (GALLERY_LOGO_PATTERN.test(lower)) return true;
  if (GALLERY_ICON_PATTERN.test(lower)) return true;
  if (GALLERY_THUMBNAIL_PATTERN.test(lower)) return true;
  if (GALLERY_NON_PRODUCT_PATTERN.test(lower)) return true;
  if (/\.png(?:\?|$)/i.test(lower) && GALLERY_FEATURE_ICON_PATTERN.test(lower)) return true;
  if (/\b(?:16x16|32x32|48x48|64x64|96x96|128x128|favicon)\b/i.test(lower)) return true;
  if (/\.svg(?:\?|$)/i.test(lower)) return true;

  const dimensions = lower.match(GALLERY_DIMENSION_SUFFIX_PATTERN);
  if (dimensions) {
    const width = Number.parseInt(dimensions[1], 10);
    const height = Number.parseInt(dimensions[2], 10);
    if (width < 200 || height < 200) return true;
  }

  return false;
}

/** Canonical identity for deduplicating full-size images and resized variants. */
export function getGalleryImageIdentity(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname
      .replace(GALLERY_DIMENSION_SUFFIX_PATTERN, "")
      .replace(/\/(?:thumb(?:nail)?s?|small|mini|preview)\//gi, "/")
      .toLowerCase();

    return `${parsed.hostname.toLowerCase()}${pathname}`;
  } catch {
    return url
      .toLowerCase()
      .replace(GALLERY_DIMENSION_SUFFIX_PATTERN, "")
      .split("?")[0];
  }
}

/** Estimates relative image resolution so higher-quality variants win deduplication. */
export function estimateGalleryImageResolution(url: string): number {
  const lower = url.toLowerCase();

  const dimensionMatch = lower.match(GALLERY_DIMENSION_SUFFIX_PATTERN);
  if (dimensionMatch) {
    const width = Number.parseInt(dimensionMatch[1], 10);
    const height = Number.parseInt(dimensionMatch[2], 10);
    if (Number.isFinite(width) && Number.isFinite(height)) {
      return width * height;
    }
  }

  try {
    const parsed = new URL(url);
    const widthParam = Number.parseInt(
      parsed.searchParams.get("w") ??
        parsed.searchParams.get("width") ??
        parsed.searchParams.get("wid") ??
        "",
      10,
    );
    const heightParam = Number.parseInt(
      parsed.searchParams.get("h") ??
        parsed.searchParams.get("height") ??
        parsed.searchParams.get("hei") ??
        "",
      10,
    );

    if (Number.isFinite(widthParam) && Number.isFinite(heightParam)) {
      return widthParam * heightParam;
    }

    if (Number.isFinite(widthParam)) {
      return widthParam * widthParam;
    }
  } catch {
    // Fall through to filename heuristics.
  }

  if (/(?:large|full|hero|main|feature|original|max|size-full)/i.test(lower)) {
    return 10_000_000;
  }

  if (/(?:thumb|thumbnail|small|icon|mini|preview)/i.test(lower)) {
    return 100;
  }

  return 1_000_000;
}

/**
 * Curates gallery URLs for import and display:
 * deduplicates variants, drops logos/icons/thumbnails, prefers high resolution,
 * and caps the list length.
 */
export function curateGalleryImageUrls(
  urls: string[] | undefined,
  options: CurateGalleryOptions = {},
): string[] {
  const max = options.max ?? MAX_GALLERY_IMAGES;
  if (!urls?.length) return [];

  const bestByIdentity = new Map<
    string,
    { url: string; resolution: number; order: number }
  >();

  for (const [index, raw] of urls.entries()) {
    const resolved = normalizeProductImageUrl(raw);
    if (!resolved || isExcludedGalleryImage(resolved)) continue;

    const identity = getGalleryImageIdentity(resolved);
    const resolution = estimateGalleryImageResolution(resolved);
    const existing = bestByIdentity.get(identity);

    if (
      !existing ||
      resolution > existing.resolution ||
      (resolution === existing.resolution && index < existing.order)
    ) {
      bestByIdentity.set(identity, { url: resolved, resolution, order: index });
    }
  }

  const curated = Array.from(bestByIdentity.values())
    .sort((left, right) => {
      if (right.resolution !== left.resolution) {
        return right.resolution - left.resolution;
      }
      return left.order - right.order;
    })
    .map((entry) => entry.url);

  const preferred = normalizeProductImageUrl(options.preferredFirst ?? null);
  if (preferred && !isExcludedGalleryImage(preferred)) {
    const preferredIdentity = getGalleryImageIdentity(preferred);
    const withoutPreferred = curated.filter(
      (url) => getGalleryImageIdentity(url) !== preferredIdentity,
    );
    return [preferred, ...withoutPreferred].slice(0, max);
  }

  return curated.slice(0, max);
}

/** Normalizes a list of gallery image URLs, dropping invalid entries. */
export function normalizeGalleryImageUrls(urls: string[] | undefined): string[] {
  return curateGalleryImageUrls(urls);
}

/** Picks the best primary image from a main URL and optional gallery list. */
export function pickBestProductImageUrl(
  imageUrl: string | null | undefined,
  galleryImages?: string[] | null,
): string | null {
  const normalizedGallery = normalizeGalleryImageUrls(galleryImages ?? undefined);
  const normalizedMain = normalizeProductImageUrl(imageUrl);

  return normalizedMain ?? normalizedGallery[0] ?? null;
}
