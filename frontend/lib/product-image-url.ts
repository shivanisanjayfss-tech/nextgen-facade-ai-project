/** Normalizes product image URLs stored during import. */
export function normalizeProductImageUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();

    if (host === "alucobond.com" || host === "www.alucobond.com") {
      const assetPath = url.pathname.match(/\/assets\/images\/.+$/i)?.[0];
      if (assetPath) {
        return `https://www.alucobond.com${assetPath}`;
      }
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}
