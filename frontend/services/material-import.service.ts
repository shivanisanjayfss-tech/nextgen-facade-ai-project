import {
  PRODUCT_BRANDS,
  resolveProductBrand,
} from "@/lib/manufacturer-catalog";
import {
  ALUCOBOND_BRAND_PARENT_SLUGS,
  applyInheritedSpecs,
  isAlucobondBrandProductUrl,
  isAlucobondColourSeriesUrl,
} from "@/lib/alucobond-colour-series";
import {
  analyzeMaterialChanges,
  buildPersistReason,
  buildStatusReasons,
  logPersistDecision,
} from "@/lib/material-change-detection";
import { ServiceError } from "@/lib/errors";
import { normalizeMaterialCategory } from "@/lib/material-categories";
import {
  curateGalleryImageUrls,
  normalizeGalleryImageUrls,
  normalizeProductImageUrl,
  pickBestProductImageUrl,
} from "@/lib/product-image-url";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { resolveManufacturerIdentity } from "@/services/manufacturer-identity.service";
import { parseMaterialSpecs } from "@/lib/material-specs";
import { resolveAlpolicSlug } from "@/lib/alpolic-products";
import { slugify } from "@/lib/utils";
import type { MaterialRow } from "@/types/database";
import { DB_TABLES } from "@/types/database";
import type {
  CrawledProduct,
  MaterialPersistDecision,
  MaterialPersistResult,
  PersistCrawledProductsOptions,
  ProductType,
} from "@/types/import";

export type { PersistCrawledProductsOptions };

type PersistOutcome = "imported" | "updated" | "skipped";

type MaterialMatchKind = "source_url" | "slug" | "manufacturer_id" | "none";

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
> & {
  manufacturer_id?: string | null;
};

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
  const fromAlpolic = resolveAlpolicSlug(product.sourceUrl);
  if (fromAlpolic) return fromAlpolic;

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

/** Classifies a crawled product into a persisted catalogue product type. */
function resolveProductType(product: CrawledProduct): ProductType {
  if (product.productType) return product.productType;

  switch (product.pageType) {
    case "colour-series":
      return "Colour Series";
    case "product-family":
      return "Product Family";
    default:
      return "Product";
  }
}

function buildSpecs(product: CrawledProduct): Record<string, unknown> {
  const specs: Record<string, unknown> = {};

  specs.productType = resolveProductType(product);

  // Generic technical specs extracted from the product page. Added first so
  // that the more targeted typed extractors below take precedence on overlap.
  if (product.technicalSpecs) {
    for (const [key, value] of Object.entries(product.technicalSpecs)) {
      const normalized = normalizeText(value);
      if (normalized) specs[key] = normalized;
    }
  }

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

  const brand = resolveProductBrand({
    manufacturer: product.manufacturer,
    brand: product.brand,
    sourceUrl: product.sourceUrl,
  });
  if (brand) specs.brand = brand;
  if (product.finish) specs.finish = normalizeText(product.finish);
  if (product.surface) specs.surface = normalizeText(product.surface);
  if (product.availableColours?.length) specs.colours = product.availableColours;
  if (product.features?.length) specs.features = product.features;
  // A structured applications list (bullet points) supersedes the loose
  // "Applications:" string captured by the generic spec extractor.
  if (product.applications?.length) specs.applications = product.applications;
  if (product.certifications?.length) specs.certifications = product.certifications;
  if (product.inheritedSpecsFrom) {
    specs.inheritedFrom = normalizeText(product.inheritedSpecsFrom);
  }

  if (product.galleryImages?.length) {
    specs.galleryImages = normalizeGalleryImageUrls(product.galleryImages);
  }

  if (product.brochureUrl) specs.brochureUrl = product.brochureUrl.trim();
  if (product.installationGuideUrl) {
    specs.installationGuideUrl = product.installationGuideUrl.trim();
  }
  if (product.technicalManualUrl) {
    specs.technicalManualUrl = product.technicalManualUrl.trim();
  }
  if (product.maintenanceGuideUrl) {
    specs.maintenanceGuideUrl = product.maintenanceGuideUrl.trim();
  }

  if (product.sourceUrl) {
    try {
      specs.manufacturerWebsite = new URL(product.sourceUrl).origin;
    } catch {
      // Ignore invalid source URLs.
    }
  }

  return specs;
}

/** Maps a crawled product to a materials-table upsert row (identity resolved before save). */
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
    image_url: normalizeProductImageUrl(product.imageUrl?.trim() || null),
    datasheet_url: product.datasheetUrl?.trim() || null,
    source_url: product.sourceUrl.trim(),
    tags: buildImportTags(product),
  };
}


function isPermissionError(message: string): boolean {
  return message.includes("permission denied");
}

function isMissingManufacturerIdColumn(message: string): boolean {
  return message.includes("manufacturer_id") && message.includes("does not exist");
}

async function applyManufacturerIdentity(
  incoming: MaterialUpsertRow,
  options?: PersistCrawledProductsOptions,
): Promise<MaterialUpsertRow> {
  const identity = await resolveManufacturerIdentity({
    manufacturerId: options?.manufacturerId ?? incoming.manufacturer_id ?? undefined,
    rawName: options?.registryName ?? incoming.manufacturer,
    website: incoming.source_url ?? undefined,
    sourceUrl: incoming.source_url ?? undefined,
  });

  const specs = {
    ...(incoming.specs as Record<string, unknown>),
  };

  const brand = options?.registryBrand ?? identity.brand;
  if (brand) {
    specs.brand = brand;
  }

  const tags = new Set(incoming.tags ?? []);
  if (identity.canonicalName) {
    tags.add(slugify(normalizeText(identity.canonicalName)));
  }
  tags.delete(slugify(normalizeText(incoming.manufacturer)));

  // Prefer explicit registry id from import context, then resolved identity.
  const manufacturerId =
    options?.manufacturerId ?? identity.manufacturerId ?? incoming.manufacturer_id ?? null;

  if (!manufacturerId) {
    console.warn(
      `[persist] manufacturer_id unresolved for "${incoming.manufacturer}" (${incoming.source_url ?? "no source"}) — writing manufacturer text only for backward compatibility.`,
    );
  }

  return {
    ...incoming,
    manufacturer_id: manufacturerId,
    manufacturer:
      options?.registryName?.trim() ||
      identity.canonicalName ||
      incoming.manufacturer,
    specs,
    tags: normalizeTags(Array.from(tags)),
  };
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
  const normalizedName = incoming.name.toLowerCase();

  if (incoming.manufacturer_id) {
    const { data: byId, error: byIdError } = await supabase
      .from(DB_TABLES.materials)
      .select("*")
      .eq("manufacturer_id", incoming.manufacturer_id);

    if (byIdError) {
      throw new ServiceError(
        formatPersistError(byIdError, "lookup by manufacturer_id and name"),
        "DATABASE_ERROR",
        500,
      );
    }

    const match = (byId ?? []).find(
      (row) => normalizeText((row as MaterialRow).name).toLowerCase() === normalizedName,
    );

    return match ? (match as MaterialRow) : null;
  }

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
    return { row: byManufacturerName, kind: "manufacturer_id" };
  }

  return { row: null, kind: "none" };
}

function mergeSpecs(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...existing, ...incoming };

  const existingGallery = normalizeGalleryImageUrls(
    Array.isArray(existing.galleryImages)
      ? (existing.galleryImages as string[])
      : undefined,
  );
  const incomingGallery = normalizeGalleryImageUrls(
    Array.isArray(incoming.galleryImages)
      ? (incoming.galleryImages as string[])
      : undefined,
  );

  if (incomingGallery.length > 0) {
    merged.galleryImages = curateGalleryImageUrls([
      ...incomingGallery,
      ...existingGallery,
    ]);
  } else if (existingGallery.length > 0) {
    merged.galleryImages = existingGallery;
  }

  const existingBrand =
    typeof existing.brand === "string" ? existing.brand.trim() : "";
  const incomingBrand =
    typeof incoming.brand === "string" ? incoming.brand.trim() : "";

  if (incomingBrand) {
    merged.brand = incomingBrand;
  } else if (existingBrand) {
    merged.brand = existingBrand;
  }

  return merged;
}

/** Merges incoming data onto an existing row without creating a duplicate. */
function mergeIncomingWithExisting(
  existing: MaterialRow,
  incoming: MaterialUpsertRow,
): MaterialUpsertRow {
  const existingSpecs = parseMaterialSpecs(existing.specs) as Record<string, unknown>;
  const incomingImage = normalizeProductImageUrl(incoming.image_url);
  const existingImage = normalizeProductImageUrl(existing.image_url);
  const galleryImages = Array.isArray(existingSpecs.galleryImages)
    ? (existingSpecs.galleryImages as string[])
    : undefined;

  return {
    ...incoming,
    slug: existing.slug || incoming.slug,
    source_url: incoming.source_url || existing.source_url,
    category: incoming.category || existing.category,
    manufacturer: incoming.manufacturer || existing.manufacturer,
    manufacturer_id: incoming.manufacturer_id ?? existing.manufacturer_id ?? null,
    image_url:
      incomingImage ??
      pickBestProductImageUrl(existing.image_url, galleryImages) ??
      existingImage,
    datasheet_url: incoming.datasheet_url?.trim() || existing.datasheet_url || null,
    specs: mergeSpecs(existingSpecs, incoming.specs as Record<string, unknown>),
  };
}

async function updateExistingMaterial(
  supabase: NonNullable<ReturnType<typeof getSupabaseServer>>,
  existing: MaterialRow,
  incoming: MaterialUpsertRow,
  options?: PersistCrawledProductsOptions,
): Promise<void> {
  const merged = mergeIncomingWithExisting(existing, incoming);
  const payload = await applyManufacturerIdentity(merged, options);
  let { error } = await supabase
    .from(DB_TABLES.materials)
    .update(payload)
    .eq("id", existing.id);

  if (error && isMissingManufacturerIdColumn(error.message)) {
    const { manufacturer_id: _omit, ...compatPayload } = payload;
    ({ error } = await supabase
      .from(DB_TABLES.materials)
      .update(compatPayload)
      .eq("id", existing.id));
  }

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
  options?: PersistCrawledProductsOptions,
): Promise<boolean> {
  const payload = await applyManufacturerIdentity(incoming, options);
  let { error } = await supabase.from(DB_TABLES.materials).insert(payload);

  if (error && isMissingManufacturerIdColumn(error.message)) {
    const { manufacturer_id: _omit, ...compatPayload } = payload;
    ({ error } = await supabase.from(DB_TABLES.materials).insert(compatPayload));
  }

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
  options?: PersistCrawledProductsOptions,
): Promise<{
  outcome: PersistOutcome;
  merged: boolean;
  decision: MaterialPersistDecision;
}> {
  const existing = match.row;
  const merged = match.kind === "slug" || match.kind === "manufacturer_id";

  if (existing) {
    const payload = mergeIncomingWithExisting(existing, incoming);
    const analysis = analyzeMaterialChanges(existing, payload);

    if (analysis.unchanged) {
      const reason = buildPersistReason({
        outcome: "skipped",
        matchKind: match.kind,
        analysis,
      });
      const statusReasons = buildStatusReasons({
        outcome: "skipped",
        analysis,
      });
      const decision: MaterialPersistDecision = {
        productName: incoming.name,
        sourceUrl: incoming.source_url ?? "",
        slug: incoming.slug,
        outcome: "skipped",
        matchKind: match.kind,
        reason,
        statusReasons,
        changedFields: [],
        unchangedFields: analysis.unchangedFields,
      };
      logPersistDecision({
        productName: decision.productName,
        slug: decision.slug,
        sourceUrl: decision.sourceUrl,
        outcome: "skipped",
        matchKind: match.kind,
        reason,
        statusReasons,
        analysis,
      });
      return { outcome: "skipped", merged, decision };
    }

    await updateExistingMaterial(supabase, existing, incoming, options);
    const reason = buildPersistReason({
      outcome: "updated",
      matchKind: match.kind,
      analysis,
    });
    const statusReasons = buildStatusReasons({
      outcome: "updated",
      analysis,
    });
    const decision: MaterialPersistDecision = {
      productName: incoming.name,
      sourceUrl: incoming.source_url ?? "",
      slug: incoming.slug,
      outcome: "updated",
      matchKind: match.kind,
      reason,
      statusReasons,
      changedFields: analysis.changedFields,
      unchangedFields: analysis.unchangedFields,
    };
    logPersistDecision({
      productName: decision.productName,
      slug: decision.slug,
      sourceUrl: decision.sourceUrl,
      outcome: "updated",
      matchKind: match.kind,
      reason,
      statusReasons,
      analysis,
    });
    return { outcome: "updated", merged, decision };
  }

  const inserted = await insertMaterial(supabase, incoming, options);
  if (inserted) {
    const statusReasons = buildStatusReasons({ outcome: "imported" });
    const reason = buildPersistReason({
      outcome: "imported",
      matchKind: match.kind,
    });
    const decision: MaterialPersistDecision = {
      productName: incoming.name,
      sourceUrl: incoming.source_url ?? "",
      slug: incoming.slug,
      outcome: "imported",
      matchKind: "none",
      reason,
      statusReasons,
      changedFields: [],
      unchangedFields: [],
    };
    logPersistDecision({
      productName: decision.productName,
      slug: decision.slug,
      sourceUrl: decision.sourceUrl,
      outcome: "imported",
      matchKind: "none",
      reason,
      statusReasons,
    });
    return { outcome: "imported", merged: false, decision };
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
  options?: PersistCrawledProductsOptions,
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
    decisions: [],
  };

  // Colour-series pages inherit engineering specs from their parent brand
  // product. Detect them by source URL — the stored manufacturer is the
  // canonical "3A Composites", not "alucobond".
  const needsParentCatalog = products.some((product) =>
    isAlucobondColourSeriesUrl(product.sourceUrl),
  );
  const parentCatalog = needsParentCatalog
    ? await loadAlucobondParentCatalog(supabase, products)
    : new Map<string, AlucobondParentRecord>();

  for (const product of products) {
    try {
      const enriched = enrichColourSeriesProduct(product, parentCatalog);
      const mapped = mapCrawledProductToMaterialRow(enriched);
      const incoming = await applyManufacturerIdentity(mapped, options);
      const match = await findExistingMaterial(supabase, incoming);
      const { outcome, merged, decision } = await upsertMaterialRow(
        supabase,
        incoming,
        match,
        options,
      );

      result.decisions.push(decision);

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

      const statusReasons = buildStatusReasons({
        outcome: "failed",
        errorMessage: message,
      });

      result.decisions.push({
        productName: product.productName,
        sourceUrl: product.sourceUrl,
        slug: resolveSlug(product),
        outcome: "failed",
        matchKind: "none",
        reason: statusReasons[0],
        statusReasons,
        changedFields: [],
        unchangedFields: [],
        errorMessage: message,
      });

      result.errors.push({
        sourceUrl: product.sourceUrl,
        productName: product.productName,
        message,
      });
    }
  }

  console.info(
    `[persist] Summary — imported=${result.imported}, updated=${result.updated}, skipped=${result.skipped}, failed=${result.errors.length}, duplicates_merged=${result.duplicates_merged}`,
  );

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
