import { resolveImportStrategy } from "@/services/import-strategies";

export type ImportMode = "quick" | "full";

export interface ImportLimits {
  maxPages: number;
  limit: number;
  timeout: number;
}

export const IMPORT_MODE_LIMITS: Record<ImportMode, ImportLimits> = {
  quick: { maxPages: 10, limit: 10, timeout: 30_000 },
  full: { maxPages: 50, limit: 50, timeout: 180_000 },
};

/** Resolves crawl limits for the selected admin import mode. */
export function resolveImportModeLimits(mode: ImportMode): ImportLimits {
  return IMPORT_MODE_LIMITS[mode];
}

/** Manufacturer-aware crawl limits tuned for faster admin imports. */
export function resolveImportLimits(manufacturer: string): ImportLimits {
  return resolveImportStrategy(manufacturer).getImportLimits();
}
