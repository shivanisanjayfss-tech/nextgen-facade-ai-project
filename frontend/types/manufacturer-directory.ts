import type { MaterialCategory } from "@/types/material";
import type { ImportHistoryStatus } from "@/types/import-history";

/** Import status shown on manufacturer directory cards. */
export type ManufacturerImportStatus =
  | ImportHistoryStatus
  | "catalogue";

export interface ManufacturerDirectoryEntry {
  name: string;
  slug: string;
  category: MaterialCategory;
  productCount: number;
  country?: string;
  logoUrl?: string;
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
}
