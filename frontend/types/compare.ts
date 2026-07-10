import type { Material } from "./material";

export interface ComparisonCriteria {
  key: keyof Material["specs"] | "name" | "manufacturer" | "category";
  label: string;
}

export interface ComparisonResult {
  materials: Material[];
  criteria: ComparisonCriteria[];
  aiSummary?: string;
}

export interface CompareRequest {
  materialIds: string[];
}
