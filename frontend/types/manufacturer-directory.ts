import type { MaterialCategory } from "@/types/material";
import type { ImportHistoryStatus } from "@/types/import-history";

/** Import status shown on manufacturer directory cards. */
export type ManufacturerImportStatus =
  | ImportHistoryStatus
  | "catalogue";

export interface ManufacturerDirectoryEntry {
  /** Registry primary key when sourced from manufacturers table. */
  id?: string;
  name: string;
  slug: string;
  category: MaterialCategory;
  productCount: number;
  country?: string;
  logoUrl?: string;
  brand?: string;
  importStatus: ManufacturerImportStatus;
  lastImportDate?: string;
  productsHref: string;
  profileHref: string;
}

export interface ManufacturerCategoryGroup {
  category: MaterialCategory;
  manufacturers: ManufacturerDirectoryEntry[];
  totalProducts: number;
}

export interface ManufacturerDirectoryResult {
  groups: ManufacturerCategoryGroup[];
  totalManufacturers: number;
  totalProducts: number;
  /** Always "registry" when manufacturers table is the source of truth. */
  source?: "registry";
}
