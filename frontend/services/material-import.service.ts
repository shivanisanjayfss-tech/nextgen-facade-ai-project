import { ServiceError } from "@/lib/errors";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { slugify } from "@/lib/utils";
import type { MaterialRow } from "@/types/database";
import { DB_TABLES } from "@/types/database";
import type { CrawledProduct, MaterialPersistResult } from "@/types/import";
import type { MaterialCategory } from "@/types";

const MATERIAL_CATEGORIES: MaterialCategory[] = [
  "ACP",
  "Glass",
  "Stone",
  "HPL",
  "Louvers",
  "Metal",
  "Composite",
  "Other",
];

/** DB columns written during import — slug and source_url both have unique constraints. */
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

function normalizeCategory(value: string): MaterialCategory {
  const match = MATERIAL_CATEGORIES.find(
    (category) => category.toLowerCase() === value.toLowerCase(),
  );
  return match ?? "Other";
}

/** Prefer a stable URL path segment; fall back to product name. */
function resolveSlug(product: CrawledProduct): string {
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

function buildImportTags(manufacturer: string): string[] {
  return ["imported", slugify(manufacturer)];
}

function buildSpecs(product: CrawledProduct): Record<string, string> {
  const specs: Record<string, string> = {};
  if (product.fireRating) specs.fireRating = product.fireRating;
  if (product.thickness) specs.thickness = product.thickness;
  if (product.dimensions) specs.dimensions = product.dimensions;
  return specs;
}

/** Maps a crawled product to a materials-table upsert row. */
export function mapCrawledProductToMaterialRow(
  product: CrawledProduct,
): MaterialUpsertRow {
  return {
    name: product.productName,
    slug: resolveSlug(product),
    category: normalizeCategory(product.category),
    manufacturer: product.manufacturer,
    description: product.description ?? "",
    specs: buildSpecs(product),
    image_url: product.imageUrl ?? null,
    datasheet_url: product.datasheetUrl ?? null,
    source_url: product.sourceUrl,
    tags: buildImportTags(product.manufacturer),
  };
}

function normalizeComparable(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).trim();
}

/** Returns true when an existing row already matches the incoming import data. */
function isUnchanged(existing: MaterialRow, incoming: MaterialUpsertRow): boolean {
  const fields: Array<keyof MaterialUpsertRow> = [
    "name",
    "slug",
    "category",
    "manufacturer",
    "description",
    "specs",
    "image_url",
    "datasheet_url",
    "source_url",
    "tags",
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

async function findExistingMaterial(
  supabase: NonNullable<ReturnType<typeof getSupabaseServer>>,
  incoming: MaterialUpsertRow,
): Promise<MaterialRow | null> {
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

  if (bySourceUrl) return bySourceUrl as MaterialRow;

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

  return (bySlug as MaterialRow | null) ?? null;
}

/**
 * Upserts a single material row.
 * Prefers onConflict: source_url; falls back to onConflict: slug for legacy rows.
 */
async function upsertMaterialRow(
  supabase: NonNullable<ReturnType<typeof getSupabaseServer>>,
  incoming: MaterialUpsertRow,
  existing: MaterialRow | null,
): Promise<PersistOutcome> {
  if (existing && isUnchanged(existing, incoming)) {
    return "skipped";
  }

  // Legacy row matched by slug but has no source_url — update in place to avoid slug collision.
  if (existing && !existing.source_url && incoming.source_url) {
    const { error } = await supabase
      .from(DB_TABLES.materials)
      .update(incoming)
      .eq("id", existing.id);

    if (error) {
      throw new ServiceError(
        formatPersistError(error, "update legacy row"),
        "DATABASE_ERROR",
        500,
      );
    }

    return "updated";
  }

  const { error: sourceUpsertError } = await supabase
    .from(DB_TABLES.materials)
    .upsert(incoming, { onConflict: "source_url" });

  if (!sourceUpsertError) {
    return existing ? "updated" : "imported";
  }

  // Slug collision on a new source_url — resolve via slug upsert instead of creating a duplicate.
  if (sourceUpsertError.message.includes("duplicate key")) {
    const { error: slugUpsertError } = await supabase
      .from(DB_TABLES.materials)
      .upsert(incoming, { onConflict: "slug" });

    if (slugUpsertError) {
      throw new ServiceError(
        formatPersistError(slugUpsertError, "upsert by slug"),
        "DATABASE_ERROR",
        500,
      );
    }

    return existing ? "updated" : "imported";
  }

  throw new ServiceError(
    formatPersistError(sourceUpsertError, "upsert by source_url"),
    "DATABASE_ERROR",
    500,
  );
}

/**
 * Upserts crawled products into the materials table.
 * Deduplicates via unique source_url / slug constraints. Per-product failures are
 * collected and do not stop the remaining imports.
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
    errors: [],
  };

  for (const product of products) {
    try {
      const incoming = mapCrawledProductToMaterialRow(product);
      const existing = await findExistingMaterial(supabase, incoming);
      const outcome = await upsertMaterialRow(supabase, incoming, existing);

      if (outcome === "imported") result.imported += 1;
      else if (outcome === "updated") result.updated += 1;
      else result.skipped += 1;
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
