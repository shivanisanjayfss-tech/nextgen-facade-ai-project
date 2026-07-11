import { generateComparisonSummary } from "@/lib/gemini";
import { getMaterialsByIds } from "@/services/material.service";
import type { ComparisonCriteria, ComparisonResult } from "@/types";

const COMPARISON_CRITERIA: ComparisonCriteria[] = [
  { key: "category", label: "Category" },
  { key: "manufacturer", label: "Manufacturer" },
  { key: "fireRating", label: "Fire Rating" },
  { key: "thermalConductivity", label: "Thermal Conductivity" },
  { key: "weight", label: "Weight" },
  { key: "thickness", label: "Thickness" },
  { key: "windLoad", label: "Wind Load" },
  { key: "uValue", label: "U-Value" },
  { key: "warranty", label: "Warranty" },
];

/** Compares materials side-by-side with optional AI-generated summary. */
export async function compareMaterials(materialIds: string[]): Promise<ComparisonResult> {
  const materials = await getMaterialsByIds(materialIds);

  let aiSummary: string | undefined;

  try {
    const summary = await generateComparisonSummary(
      materials.map((m) => ({
        name: m.name,
        category: m.category,
        specs: m.specs as Record<string, string | undefined>,
      })),
    );
    if (summary) aiSummary = summary;
  } catch {
    // AI summary is optional — comparison still works without it
  }

  return {
    materials,
    criteria: COMPARISON_CRITERIA,
    aiSummary,
  };
}

export { COMPARISON_CRITERIA };
