import { normalizeGalleryImageUrls } from "@/lib/product-image-url";
import { parseMaterialSpecs } from "@/lib/material-specs";
import type { MaterialPersistOutcome } from "@/types/import";
import type { MaterialRow } from "@/types/database";

type ComparableRow = Pick<
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

export interface MaterialFieldChange {
  field: string;
  previous: string;
  next: string;
}

export interface MaterialChangeAnalysis {
  unchanged: boolean;
  changedFields: MaterialFieldChange[];
  unchangedFields: string[];
}

const TOP_LEVEL_FIELDS = [
  "name",
  "manufacturer",
  "description",
  "image_url",
  "datasheet_url",
  "category",
  "source_url",
] as const;

const TRACKED_SPEC_FIELDS = [
  "galleryImages",
  "features",
  "applications",
  "certifications",
  "brochureUrl",
  "installationGuideUrl",
  "technicalManualUrl",
  "maintenanceGuideUrl",
  "fireRating",
  "thickness",
  "dimensions",
  "weight",
  "panelWeight",
  "coreMaterial",
  "warranty",
  "thermalConductivity",
  "windLoad",
  "uValue",
  "finish",
  "surface",
  "colours",
  "colourSeries",
  "productFamily",
  "productType",
  "brand",
  "manufacturerWebsite",
] as const;

const DOWNLOAD_FIELDS = new Set([
  "specs.brochureUrl",
  "specs.installationGuideUrl",
  "specs.technicalManualUrl",
  "specs.maintenanceGuideUrl",
]);

const SPECIFICATION_FIELDS = new Set([
  "specs.features",
  "specs.applications",
  "specs.certifications",
  "specs.fireRating",
  "specs.thickness",
  "specs.dimensions",
  "specs.weight",
  "specs.panelWeight",
  "specs.coreMaterial",
  "specs.warranty",
  "specs.thermalConductivity",
  "specs.windLoad",
  "specs.uValue",
  "specs.finish",
  "specs.surface",
  "specs.colours",
  "specs.colourSeries",
  "specs.productFamily",
  "specs.productType",
]);

const MANUFACTURER_FIELDS = new Set([
  "manufacturer",
  "name",
  "specs.brand",
  "specs.manufacturerWebsite",
]);

const CHANGE_LABELS: Record<string, string> = {
  image_url: "Hero image",
  datasheet_url: "Datasheet",
  description: "Description",
  name: "Product name",
  manufacturer: "Manufacturer",
  category: "Category",
  source_url: "Source URL",
  tags: "Tags",
  "specs.galleryImages": "Gallery",
  "specs.features": "Features",
  "specs.applications": "Applications",
  "specs.certifications": "Certifications",
  "specs.brochureUrl": "Brochure download",
  "specs.installationGuideUrl": "Installation guide",
  "specs.technicalManualUrl": "Technical manual",
  "specs.maintenanceGuideUrl": "Maintenance guide",
  "specs.fireRating": "Fire rating",
  "specs.thickness": "Thickness",
  "specs.dimensions": "Dimensions",
  "specs.weight": "Weight",
  "specs.brand": "Brand",
  "specs.manufacturerWebsite": "Manufacturer website",
};

function normalizeScalar(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim().replace(/\s+/g, " ");
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeScalar(entry))
    .filter(Boolean)
    .sort();
}

function normalizeGallery(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return normalizeGalleryImageUrls(value as string[]).sort();
}

function formatValue(field: string, value: unknown): string {
  if (field === "galleryImages" || field === "specs.galleryImages") {
    const gallery = normalizeGallery(value);
    return gallery.length > 0 ? gallery.join(", ") : "(empty)";
  }

  if (
    field === "tags" ||
    field === "features" ||
    field === "applications" ||
    field === "certifications" ||
    field === "colours" ||
    field.startsWith("specs.")
  ) {
    const raw = field.startsWith("specs.") ? value : value;
    if (Array.isArray(raw)) {
      const items = normalizeStringArray(raw);
      return items.length > 0 ? items.join(", ") : "(empty)";
    }
  }

  if (value === null || value === undefined || value === "") {
    return "(empty)";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return normalizeScalar(value);
}

function compareField(
  field: string,
  previousValue: unknown,
  nextValue: unknown,
): MaterialFieldChange | null {
  const previous = formatValue(field, previousValue);
  const next = formatValue(field, nextValue);

  if (previous === next) {
    return null;
  }

  return { field, previous, next };
}

function compareSpecField(
  field: string,
  existingSpecs: Record<string, unknown>,
  incomingSpecs: Record<string, unknown>,
): MaterialFieldChange | null {
  return compareField(`specs.${field}`, existingSpecs[field], incomingSpecs[field]);
}

function labelForField(field: string): string {
  return CHANGE_LABELS[field] ?? field.replace(/^specs\./, "");
}

/** Compares an existing DB row with the merged upsert payload field-by-field. */
export function analyzeMaterialChanges(
  existing: ComparableRow,
  payload: ComparableRow,
): MaterialChangeAnalysis {
  const changedFields: MaterialFieldChange[] = [];
  const unchangedFields: string[] = [];

  for (const field of TOP_LEVEL_FIELDS) {
    const change = compareField(field, existing[field], payload[field]);
    if (change) {
      changedFields.push(change);
    } else {
      unchangedFields.push(field);
    }
  }

  const tagsChange = compareField("tags", existing.tags, payload.tags);
  if (tagsChange) {
    changedFields.push(tagsChange);
  } else {
    unchangedFields.push("tags");
  }

  const existingSpecs = parseMaterialSpecs(existing.specs);
  const incomingSpecs = parseMaterialSpecs(payload.specs);

  for (const field of TRACKED_SPEC_FIELDS) {
    const change = compareSpecField(field, existingSpecs, incomingSpecs);
    if (change) {
      changedFields.push(change);
    } else {
      unchangedFields.push(`specs.${field}`);
    }
  }

  const existingSpecKeys = new Set(Object.keys(existingSpecs));
  const incomingSpecKeys = new Set(Object.keys(incomingSpecs));
  const dynamicKeys = new Set([...existingSpecKeys, ...incomingSpecKeys]);

  for (const field of dynamicKeys) {
    if ((TRACKED_SPEC_FIELDS as readonly string[]).includes(field)) continue;

    const change = compareSpecField(field, existingSpecs, incomingSpecs);
    if (change) {
      changedFields.push(change);
    } else if (existingSpecs[field] !== undefined || incomingSpecs[field] !== undefined) {
      unchangedFields.push(`specs.${field}`);
    }
  }

  return {
    unchanged: changedFields.length === 0,
    changedFields,
    unchangedFields,
  };
}

function buildSkippedReasons(analysis: MaterialChangeAnalysis): string[] {
  const unchanged = new Set(analysis.unchangedFields);
  const reasons: string[] = [];

  if (unchanged.has("image_url")) reasons.push("Same hero image");
  if (unchanged.has("datasheet_url")) reasons.push("Same datasheet");
  if (unchanged.has("specs.galleryImages")) reasons.push("Same gallery");

  if ([...DOWNLOAD_FIELDS].some((field) => unchanged.has(field))) {
    reasons.push("Same downloads");
  }

  if ([...SPECIFICATION_FIELDS].some((field) => unchanged.has(field))) {
    reasons.push("Same specifications");
  }

  if ([...MANUFACTURER_FIELDS].some((field) => unchanged.has(field))) {
    reasons.push("Same manufacturer data");
  }

  if (unchanged.has("description")) reasons.push("Same description");

  if (reasons.length === 0) {
    reasons.push("No changes detected");
  }

  return reasons;
}

function buildUpdatedReasons(analysis: MaterialChangeAnalysis): string[] {
  return analysis.changedFields.map((change) => {
    const label = labelForField(change.field);
    return `${label} changed`;
  });
}

/** Human-readable reasons shown in the import run details UI. */
export function buildStatusReasons(options: {
  outcome: MaterialPersistOutcome;
  analysis?: MaterialChangeAnalysis;
  errorMessage?: string;
}): string[] {
  if (options.outcome === "failed") {
    return [options.errorMessage ?? "Import failed"];
  }

  if (options.outcome === "imported") {
    return ["New product — not found in database"];
  }

  if (options.outcome === "updated" && options.analysis) {
    const reasons = buildUpdatedReasons(options.analysis);
    return reasons.length > 0 ? reasons : ["Existing product changed"];
  }

  if (options.outcome === "skipped" && options.analysis) {
    return buildSkippedReasons(options.analysis);
  }

  return ["No changes detected"];
}

export function buildPersistReason(options: {
  outcome: MaterialPersistOutcome;
  matchKind: "source_url" | "slug" | "manufacturer_name" | "none";
  analysis?: MaterialChangeAnalysis;
  errorMessage?: string;
}): string {
  const statusReasons = buildStatusReasons(options);

  if (options.outcome === "imported") {
    return statusReasons[0];
  }

  if (options.outcome === "failed") {
    return statusReasons[0];
  }

  if (options.outcome === "updated") {
    return `Updated — ${statusReasons.join(", ")}`;
  }

  return `Skipped — ${statusReasons.join(", ")} (matched by ${options.matchKind})`;
}

export function logPersistDecision(options: {
  productName: string;
  slug: string;
  sourceUrl: string;
  outcome: MaterialPersistOutcome;
  matchKind: "source_url" | "slug" | "manufacturer_name" | "none";
  reason: string;
  statusReasons: string[];
  analysis?: MaterialChangeAnalysis;
}): void {
  const prefix = `[persist] ${options.outcome.toUpperCase()} ${options.productName} (${options.slug})`;

  console.info(`${prefix} — ${options.reason}`);
  console.info(`${prefix} — reasons: ${options.statusReasons.join("; ")}`);

  if (options.analysis?.changedFields.length) {
    for (const change of options.analysis.changedFields) {
      console.info(
        `${prefix} · ${change.field}: ${change.previous} -> ${change.next}`,
      );
    }
  }
}
