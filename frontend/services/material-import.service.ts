import { normalizeMaterialCategory } from "@/lib/material-categories";
import {
  ALUCOBOND_BRAND_PARENT_SLUGS,
  applyInheritedSpecs,
  isAlucobondBrandProductUrl,
  isAlucobondColourSeriesUrl,
} from "@/lib/alucobond-colour-series";
import { ServiceError } from "@/lib/errors";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { parseMaterialSpecs } from "@/lib/material-specs";
import { slugify } from "@/lib/utils";
import type { MaterialRow } from "@/types/database";
import { DB_TABLES } from "@/types/database";
import type { CrawledProduct, MaterialPersistResult } from "@/types/import";

type MaterialUpsertRow = Pick<
  MaterialRow,
  | "name"
  | "slug"
  | "category"
  | "manufacturer"
  | "description"
  | "specs"
  | "image_url"
  | "datasheet_url"
  | "source_url"
  | "tags"
>;

type PersistOutcome = "imported" | "updated" | "skipped";

type MaterialMatchKind = "source_url" | "slug" | "manufacturer_name" | "none";

interface MaterialMatch {
  row: MaterialRow | null;
  kind: MaterialMatchKind;
}

/** Trims whitespace and collapses repeated spaces. */
function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Preserves official product casing — only normalizes spacing. */
function normalizeProductName(name: string): string {
  return normalizeText(name);
}

function normalizeCategory(value: string) {
  return normalizeMaterialCategory(value);
}

function normalizeTags(tags: string[]): string[] {
  return Array.from(
    new Set(tags.map((tag) => slugify(normalizeText(tag))).filter(Boolean)),
  ).sort();
}

/** Prefer a stable URL path segment; fall back to product name. */
function resolveSlug(product: CrawledProduct): string {
  const fromColourSeries = product.sourceUrl.match(/\/by-colour-series\/([^/]+)/i)?.[1];
  if (fromColourSeries) return fromColourSeries.toLowerCase();

  const fromBrand = product.sourceUrl.match(/\/by-brand\/([^/]+)/i)?.[1];
  if (fromBrand) return fromBrand.toLowerCase();

  try {
    const segment = new URL(product.sourceUrl).pathname
      .replace(/\/$/, "")
      .split("/")
      .filter(Boolean)
      .pop();
    if (segment && segment.length > 2) return slugify(segment);
  } catch {
    // Fall through to product name slug.
  }

  return slugify(product.productName);
}

function extractProductFamily(product: CrawledProduct): string | undefined {
  if (isAlucobondColourSeriesUrl(product.sourceUrl)) {
    return product.productFamily ?? "ALUCOBOND";
  }

  const fromUrl = product.sourceUrl.match(/\/by-brand\/([^/?#]+)/i)?.[1];
  if (fromUrl) {
    const head = fromUrl.split("-")[0];
    if (head === "alucobond") return "ALUCOBOND";
    if (head) return normalizeText(head);
  }

  const brandedPrefix = product.productName.match(/^([A-Z][A-Z0-9]+)/)?.[1];
  if (brandedPrefix && brandedPrefix.length > 2) return brandedPrefix;

  const firstWord = product.productName.split(/\s+/)[0];
  return firstWord && firstWord.length > 2 ? normalizeText(firstWord) : undefined;
}

function buildImportTags(product: CrawledProduct): string[] {
  const tags = new Set<string>(["imported"]);

  tags.add(slugify(normalizeText(product.manufacturer)));
  tags.add(slugify(normalizeCategory(product.category)));

  if (product.fireRating) {
    tags.add(slugify(normalizeText(product.fireRating)));
  }

  const family = extractProductFamily(product);
  if (family) {
    tags.add(slugify(family));
  }

  if (isAlucobondColourSeriesUrl(product.sourceUrl)) {
    tags.add("colour-series");
  }

  return normalizeTags(Array.from(tags));
}

function buildSpecs(product: CrawledProduct): Record<string, unknown> {
  const specs: Record<string, unknown> = {};

  if (product.fireRating) specs.fireRating = normalizeText(product.fireRating);
  if (product.thickness) specs.thickness = normalizeText(product.thickness);
  if (product.dimensions) specs.dimensions = normalizeText(product.dimensions);
  if (product.warranty) specs.warranty = normalizeText(product.warranty);
  if (product.coreMaterial) specs.coreMaterial = normalizeText(product.coreMaterial);
  if (product.weight) specs.weight = normalizeText(product.weight);
  if (product.panelWeight) specs.panelWeight = normalizeText(product.panelWeight);
  if (product.thermalConductivity) {
    specs.thermalConductivity = normalizeText(product.thermalConductivity);
  }
  if (product.windLoad) specs.windLoad = normalizeText(product.windLoad);
  if (product.uValue) specs.uValue = normalizeText(product.uValue);

  if (product.colourSeriesName) specs.colourSeries = normalizeText(product.colourSeriesName);
  if (product.productFamily) specs.productFamily = normalizeText(product.productFamily);
  if (product.finish) specs.finish = normalizeText(product.finish);
  if (product.surface) specs.surface = normalizeText(product.surface);
  if (product.availableColours?.length) specs.colours = product.availableColours;
  if (product.inheritedSpecsFrom) {
    specs.inheritedFrom = normalizeText(product.inheritedSpecsFrom);
  }

  if (product.galleryImages?.length) {
    specs.galleryImages = product.galleryImages;
  }

  if (product.brochureUrl) specs.brochureUrl = product.brochureUrl.trim();
  if (product.installationGuideUrl) {
    specs.installationGuideUrl = product.installationGuideUrl.trim();
  }
  if (product.technicalManualUrl) {
    specs.technicalManualUrl = product.technicalManualUrl.trim();
  }

  return specs;
}

/** Maps a crawled product to a normalized materials-table upsert row. */
export function mapCrawledProductToMaterialRow(
  product: CrawledProduct,
): MaterialUpsertRow {
  return {
    name: normalizeProductName(product.productName),
    slug: resolveSlug(product),
    category: normalizeCategory(product.category),
    manufacturer: normalizeText(product.manufacturer),
    description: normalizeText(product.description ?? ""),
    specs: buildSpecs(product),
    image_url: product.imageUrl?.trim() || null,
    datasheet_url: product.datasheetUrl?.trim() || null,
    source_url: product.sourceUrl.trim(),
    tags: buildImportTags(product),
  };
}

function normalizeComparable(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return JSON.stringify([...value].sort());
  }
  if (typeof value === "object") return JSON.stringify(value);
  return normalizeText(String(value));
}

/** Returns true when tracked import fields already match the incoming row. */
function isUnchanged(existing: MaterialRow, incoming: MaterialUpsertRow): boolean {
  const fields: Array<keyof MaterialUpsertRow> = [
    "name",
    "manufacturer",
    "description",
    "image_url",
    "datasheet_url",
    "tags",
    "specs",
  ];

  return fields.every(
    (field) =>
      normalizeComparable(existing[field]) === normalizeComparable(incoming[field]),
  );
}

function isPermissionError(message: string): boolean {
  return message.includes("permission denied");
}

function isMissingColumnError(message: string): boolean {
  return message.includes("source_url") && message.includes("does not exist");
}

function formatPersistError(error: { message: string }, context: string): string {
  if (isPermissionError(error.message)) {
    return `${context}: permission denied — run migration 003_materials_source_url_and_write_policies.sql in Supabase.`;
  }

  if (isMissingColumnError(error.message)) {
    return `${context}: source_url column missing — run migration 003_materials_source_url_and_write_policies.sql in Supabase.`;
  }

  return `${context}: ${error.message}`;
}

function escapeIlikeExact(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

async function findByManufacturerAndName(
  supabase: NonNullable<ReturnType<typeof getSupabaseServer>>,
  incoming: MaterialUpsertRow,
): Promise<MaterialRow | null> {
  const { data: candidates, error } = await supabase
    .from(DB_TABLES.materials)
    .select("*")
    .ilike("manufacturer", escapeIlikeExact(incoming.manufacturer));

  if (error) {
    throw new ServiceError(
      formatPersistError(error, "lookup by manufacturer and name"),
      "DATABASE_ERROR",
      500,
    );
  }

  const normalizedManufacturer = incoming.manufacturer.toLowerCase();
  const normalizedName = incoming.name.toLowerCase();

  const match = (candidates ?? []).find((row) => {
    const candidate = row as MaterialRow;
    return (
      normalizeText(candidate.manufacturer).toLowerCase() === normalizedManufacturer &&
      normalizeText(candidate.name).toLowerCase() === normalizedName
    );
  });

  return match ? (match as MaterialRow) : null;
}

async function findExistingMaterial(
  supabase: NonNullable<ReturnType<typeof getSupabaseServer>>,
  incoming: MaterialUpsertRow,
): Promise<MaterialMatch> {
  if (incoming.source_url) {
    const { data: bySourceUrl, error: sourceError } = await supabase
      .from(DB_TABLES.materials)
      .select("*")
      .eq("source_url", incoming.source_url)
      .maybeSingle();

    if (sourceError) {
      throw new ServiceError(
        formatPersistError(sourceError, "lookup by source_url"),
        "DATABASE_ERROR",
        500,
      );
    }

    if (bySourceUrl) {
      return { row: bySourceUrl as MaterialRow, kind: "source_url" };
    }
  }

  const { data: bySlug, error: slugError } = await supabase
    .from(DB_TABLES.materials)
    .select("*")
    .eq("slug", incoming.slug)
    .maybeSingle();

  if (slugError) {
    throw new ServiceError(
      formatPersistError(slugError, "lookup by slug"),
      "DATABASE_ERROR",
      500,
    );
  }

  if (bySlug) {
    return { row: bySlug as MaterialRow, kind: "slug" };
  }

  const byManufacturerName = await findByManufacturerAndName(supabase, incoming);
  if (byManufacturerName) {
    return { row: byManufacturerName, kind: "manufacturer_name" };
  }

  return { row: null, kind: "none" };
}

/** Merges incoming data onto an existing row without creating a duplicate. */
function mergeIncomingWithExisting(
  existing: MaterialRow,
  incoming: MaterialUpsertRow,
): MaterialUpsertRow {
  return {
    ...incoming,
    slug: existing.slug || incoming.slug,
    source_url: incoming.source_url || existing.source_url,
    category: incoming.category || existing.category,
  };
}

async function updateExistingMaterial(
  supabase: NonNullable<ReturnType<typeof getSupabaseServer>>,
  existing: MaterialRow,
  incoming: MaterialUpsertRow,
): Promise<void> {
  const payload = mergeIncomingWithExisting(existing, incoming);
  const { error } = await supabase
    .from(DB_TABLES.materials)
    .update(payload)
    .eq("id", existing.id);

  if (error) {
    throw new ServiceError(
      formatPersistError(error, "update existing material"),
      "DATABASE_ERROR",
      500,
    );
  }
}

async function insertMaterial(
  supabase: NonNullable<ReturnType<typeof getSupabaseServer>>,
  incoming: MaterialUpsertRow,
): Promise<boolean> {
  const { error } = await supabase.from(DB_TABLES.materials).insert(incoming);

  if (!error) return true;

  if (error.code === "23505" || /duplicate key/i.test(error.message)) {
    return false;
  }

  throw new ServiceError(
    formatPersistError(error, "insert material"),
    "DATABASE_ERROR",
    500,
  );
}

/**
 * Upserts a single material row.
 * Matches by source_url, slug, or manufacturer + name — always updates in place.
 */
async function upsertMaterialRow(
  supabase: NonNullable<ReturnType<typeof getSupabaseServer>>,
  incoming: MaterialUpsertRow,
  match: MaterialMatch,
): Promise<{ outcome: PersistOutcome; merged: boolean }> {
  const existing = match.row;
  const merged = match.kind === "slug" || match.kind === "manufacturer_name";

  if (existing) {
    const payload = mergeIncomingWithExisting(existing, incoming);
    if (isUnchanged(existing, payload)) {
      return { outcome: "skipped", merged };
    }

    await updateExistingMaterial(supabase, existing, incoming);
    return { outcome: "updated", merged };
  }

  const inserted = await insertMaterial(supabase, incoming);
  if (inserted) {
    return { outcome: "imported", merged: false };
  }

  const refound = await findExistingMaterial(supabase, incoming);
  if (refound.row) {
    return upsertMaterialRow(supabase, incoming, refound);
  }

  throw new ServiceError(
    "insert material: duplicate key conflict but existing row not found",
    "DATABASE_ERROR",
    500,
  );
}

/**
 * Upserts crawled products into the materials table.
 * Deduplicates via source_url, slug, and manufacturer + name.
 */
export async function persistCrawledProducts(
  products: CrawledProduct[],
): Promise<MaterialPersistResult> {
  if (!isSupabaseConfigured()) {
    throw new ServiceError(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      "MISSING_SUPABASE",
      503,
    );
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    throw new ServiceError("Supabase client is unavailable.", "MISSING_SUPABASE", 503);
  }

  const result: MaterialPersistResult = {
    imported: 0,
    updated: 0,
    skipped: 0,
    duplicates_merged: 0,
    errors: [],
  };

  const needsParentCatalog = products.some(
    (product) =>
      product.manufacturer.trim().toLowerCase() === "alucobond" &&
      isAlucobondColourSeriesUrl(product.sourceUrl),
  );
  const parentCatalog = needsParentCatalog
    ? await loadAlucobondParentCatalog(supabase, products)
    : new Map<string, AlucobondParentRecord>();

  for (const product of products) {
    try {
      const enriched = enrichColourSeriesProduct(product, parentCatalog);
      const incoming = mapCrawledProductToMaterialRow(enriched);
      const match = await findExistingMaterial(supabase, incoming);
      const { outcome, merged } = await upsertMaterialRow(supabase, incoming, match);

      if (outcome === "imported") result.imported += 1;
      else if (outcome === "updated") result.updated += 1;
      else result.skipped += 1;

      if (merged && outcome !== "imported") {
        result.duplicates_merged += 1;
      }
    } catch (error) {
      const message =
        error instanceof ServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unknown import error";

      result.errors.push({
        sourceUrl: product.sourceUrl,
        productName: product.productName,
        message,
      });
    }
  }

  return result;
}

interface AlucobondParentRecord {
  specs: Record<string, unknown>;
  datasheetUrl: string | null;
  brochureUrl?: string;
}

async function loadAlucobondParentCatalog(
  supabase: NonNullable<ReturnType<typeof getSupabaseServer>>,
  products: CrawledProduct[],
): Promise<Map<string, AlucobondParentRecord>> {
  const catalog = new Map<string, AlucobondParentRecord>();

  for (const product of products) {
    if (!isAlucobondBrandProductUrl(product.sourceUrl)) continue;

    const slug = resolveSlug(product);
    catalog.set(slug, {
      specs: buildSpecs(product),
      datasheetUrl: product.datasheetUrl?.trim() || null,
      brochureUrl: product.brochureUrl,
    });
  }

  const parentSlugs = Object.values(ALUCOBOND_BRAND_PARENT_SLUGS);
  for (const slug of parentSlugs) {
    if (catalog.has(slug)) continue;

    const { data, error } = await supabase
      .from(DB_TABLES.materials)
      .select("specs,datasheet_url,slug")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      throw new ServiceError(
        `lookup parent specs for ${slug}: ${error.message}`,
        "DATABASE_ERROR",
        500,
      );
    }

    if (!data) continue;

    const row = data as Pick<MaterialRow, "specs" | "datasheet_url" | "slug">;
    const specs = parseMaterialSpecs(row.specs);
    catalog.set(slug, {
      specs,
      datasheetUrl: row.datasheet_url,
      brochureUrl:
        typeof specs.brochureUrl === "string" ? specs.brochureUrl : undefined,
    });
  }

  return catalog;
}

function enrichColourSeriesProduct(
  product: CrawledProduct,
  parentCatalog: Map<string, AlucobondParentRecord>,
): CrawledProduct {
  if (!isAlucobondColourSeriesUrl(product.sourceUrl) || !product.inheritSpecsFromSlug) {
    return product;
  }

  const parent = parentCatalog.get(product.inheritSpecsFromSlug);
  if (!parent) return product;

  return applyInheritedSpecs(product, parent.specs, {
    datasheetUrl: parent.datasheetUrl,
    brochureUrl: parent.brochureUrl,
  });
}
