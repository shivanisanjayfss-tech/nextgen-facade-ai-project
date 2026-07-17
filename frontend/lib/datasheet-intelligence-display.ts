import type { DatasheetExtractedFields } from "@/types/datasheet-intelligence";

export const DATASHEET_FIELD_LABELS: Record<keyof DatasheetExtractedFields, string> = {
  productName: "Product Name",
  manufacturer: "Manufacturer",
  category: "Category",
  thickness: "Thickness",
  width: "Width",
  length: "Length",
  weight: "Weight",
  fireRating: "Fire Rating",
  thermalProperties: "Thermal Properties",
  acousticProperties: "Acoustic Properties",
  finish: "Finish",
  coating: "Coating",
  materialComposition: "Material Composition",
  warranty: "Warranty",
  certifications: "Certifications",
  applications: "Applications",
  installationNotes: "Installation Notes",
  standards: "Standards",
};

export const DATASHEET_FIELD_ORDER = Object.keys(
  DATASHEET_FIELD_LABELS,
) as Array<keyof DatasheetExtractedFields>;

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export function confidenceBadgeClass(confidence: number): string {
  if (confidence >= 0.8) return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (confidence >= 0.5) return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  return "border-white/10 bg-white/[0.03] text-white/45";
}

export function formatFieldValue(value: string | string[] | null | undefined): string {
  if (!value) return "—";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—";
  return value;
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "failed":
      return "border-red-400/30 bg-red-400/10 text-red-200";
    case "pending":
      return "border-white/10 bg-white/[0.03] text-white/50";
    default:
      return "border-sky-400/30 bg-sky-400/10 text-sky-200";
  }
}
