import type { ManufacturerImportOptions } from "@/services/manufacturer-import.service";
import type { ImportLimits } from "@/services/import-limits";

/** Parameters passed when building manufacturer-specific crawl options. */
export interface StrategyBuildParams {
  manufacturer: string;
  brand?: string;
  websiteUrl: string;
  category: string;
  maxPages?: number;
  limit?: number;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

/** Manufacturer-specific import configuration strategy. */
export interface ManufacturerImportStrategy {
  readonly id: string;
  readonly displayName: string;
  matches(manufacturer: string): boolean;
  buildOptions(params: StrategyBuildParams): ManufacturerImportOptions;
  getImportLimits(): ImportLimits;
}
