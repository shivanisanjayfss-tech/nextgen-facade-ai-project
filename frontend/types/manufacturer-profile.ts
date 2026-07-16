import type { MaterialCategory } from "@/types/material";
import type { ImportHistoryStatus } from "@/types/import-history";
import type { MaterialSummary } from "@/types";

/** Full manufacturer profile for detail pages — fully data-driven. */
export interface ManufacturerProfile {
  slug: string;
  name: string;
  brand?: string;
  description?: string;
  websiteUrl?: string;
  logoUrl?: string;
  country?: string;
  categories: MaterialCategory[];
  productCount: number;
  products: MaterialSummary[];
  importStatus: ImportHistoryStatus | "catalogue";
  lastImportDate?: string;
  lastImportStats?: {
    imported: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  configured: boolean;
  strategyKey?: string;
  autoImport: boolean;
  enabled: boolean;
}
