import type {
  ConfidentFieldValue,
  DatasheetExtractedFields,
  DatasheetRawPage,
} from "@/types/datasheet-intelligence";
import { createEmptyExtractedFields } from "@/lib/datasheet-ai-extraction";

const ARRAY_FIELDS = new Set(["certifications", "applications", "standards"]);

function isConfidentField(value: unknown): value is ConfidentFieldValue<string | string[]> {
  return (
    typeof value === "object" &&
    value !== null &&
    "confidence" in value &&
    "value" in value
  );
}

function parseStoredFields(raw: Record<string, unknown>): DatasheetExtractedFields {
  const base = createEmptyExtractedFields();

  for (const key of Object.keys(base) as Array<keyof DatasheetExtractedFields>) {
    const field = raw[key];
    if (!isConfidentField(field)) continue;
    setStoredField(base, key, field);
  }

  return base;
}

function setStoredField(
  base: DatasheetExtractedFields,
  key: keyof DatasheetExtractedFields,
  field: ConfidentFieldValue<string | string[]>,
): void {
  (base as unknown as Record<string, ConfidentFieldValue<string | string[]>>)[key] = field;
}

function mergeField(
  extracted: ConfidentFieldValue<string | string[]>,
  override: ConfidentFieldValue<string | string[]> | undefined,
): ConfidentFieldValue<string | string[]> {
  if (!override || override.value == null) return extracted;
  return {
    ...override,
    manuallyEdited: true,
    confidence: override.confidence ?? 1,
  };
}

/** Merges AI extraction with manual reviewer overrides. */
export function mergeEffectiveFields(
  extracted: DatasheetExtractedFields,
  overrides: Partial<DatasheetExtractedFields>,
): DatasheetExtractedFields {
  const effective = { ...extracted };

  for (const key of Object.keys(effective) as Array<keyof DatasheetExtractedFields>) {
    setStoredField(
      effective,
      key,
      mergeField(effective[key], overrides[key]),
    );
  }

  return effective;
}

export function parseExtractedFieldsRecord(
  raw: Record<string, unknown>,
): DatasheetExtractedFields {
  return parseStoredFields(raw);
}

export function parseManualOverridesRecord(
  raw: Record<string, unknown>,
): Partial<DatasheetExtractedFields> {
  const overrides: Partial<DatasheetExtractedFields> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!isConfidentField(value)) continue;
    (overrides as Record<string, ConfidentFieldValue<string | string[]>>)[key] = value;
  }

  return overrides;
}

function fieldToSearchText(field: ConfidentFieldValue<string | string[]> | undefined): string {
  if (!field?.value) return "";
  if (Array.isArray(field.value)) return field.value.join(" ");
  return field.value;
}

function asString(value: string | string[] | null | undefined): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value.join(", ");
  return value;
}

/** Builds denormalized search facets from effective extracted fields. */
export function buildSearchFacets(fields: DatasheetExtractedFields): {
  fireRating: string | null;
  thickness: string | null;
  finish: string | null;
  thermalValue: string | null;
  certifications: string[];
} {
  const certifications = Array.isArray(fields.certifications.value)
    ? fields.certifications.value
    : [];

  return {
    fireRating: asString(fields.fireRating.value),
    thickness: asString(fields.thickness.value),
    finish: asString(fields.finish.value),
    thermalValue: asString(fields.thermalProperties.value),
    certifications,
  };
}

export function buildSearchText(
  pages: DatasheetRawPage[],
  fields: DatasheetExtractedFields,
  aiSummary: string | null,
  technicalHighlights: string[],
): string {
  const fieldText = (Object.keys(fields) as Array<keyof DatasheetExtractedFields>)
    .map((key) => fieldToSearchText(fields[key]))
    .filter(Boolean)
    .join(" ");

  const pageText = pages.map((page) => page.text).join(" ");
  const highlights = technicalHighlights.join(" ");

  return [fieldText, aiSummary ?? "", highlights, pageText]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500_000);
}

export function sanitizeManualOverridesInput(
  input: Partial<DatasheetExtractedFields>,
): Partial<DatasheetExtractedFields> {
  const sanitized: Partial<DatasheetExtractedFields> = {};

  for (const [key, field] of Object.entries(input)) {
    if (!isConfidentField(field)) continue;

    const normalized: ConfidentFieldValue<string | string[]> = {
      value: ARRAY_FIELDS.has(key)
        ? Array.isArray(field.value)
          ? field.value.map((item) => String(item).trim()).filter(Boolean)
          : typeof field.value === "string" && field.value.trim()
            ? [field.value.trim()]
            : null
        : typeof field.value === "string"
          ? field.value.trim() || null
          : null,
      confidence: 1,
      manuallyEdited: true,
      sourcePage: field.sourcePage ?? null,
    };

    (sanitized as Record<string, ConfidentFieldValue<string | string[]>>)[key] = normalized;
  }

  return sanitized;
}
