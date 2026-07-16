import type { MaterialCategory } from "@/types/material";

/** Import cadence configured per manufacturer in the registry. */
export type ManufacturerImportFrequency = "monthly" | "weekly" | "daily";

/** Crawl strategy key stored in the manufacturer registry. */
export type ManufacturerImportStrategy =
  | "generic"
  | "alucobond"
  | "agc-glass"
  | "guardian-glass"
  | "mitsubishi-chemical"
  | "saint-gobain";

/** Supabase row shape for the `manufacturers` registry table. */
export interface ManufacturerRegistryRow {
  id: string;
  name: string;
  brand: string | null;
  category: MaterialCategory | string;
  website: string;
  logo_url: string | null;
  country: string | null;
  headquarters: string | null;
  description: string | null;
  aliases: string[];
  website_host: string | null;
  enabled: boolean;
  auto_import: boolean;
  import_frequency: ManufacturerImportFrequency;
  import_strategy: ManufacturerImportStrategy;
  last_imported_at: string | null;
  next_import_at: string | null;
  last_status: string | null;
  total_products: number;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface ManufacturerRegistrySearchParams {
  q?: string;
  category?: string;
  country?: string;
  website?: string;
}

/** Options when building the automatic import queue for the scheduler. */
export interface BuildImportQueueOptions {
  /** When set, only manufacturers with this cadence are included (e.g. monthly cron). */
  frequency?: ManufacturerImportFrequency;
}

export interface UpdateManufacturerRegistryInput {
  name?: string;
  enabled?: boolean;
  auto_import?: boolean;
  import_frequency?: ManufacturerImportFrequency;
  import_strategy?: ManufacturerImportStrategy;
  website?: string;
  website_host?: string | null;
  category?: string;
  brand?: string | null;
  logo_url?: string | null;
  aliases?: string[];
  country?: string | null;
  headquarters?: string | null;
  description?: string | null;
}

/** Input for creating a new manufacturer registry row. */
export interface CreateManufacturerRegistryInput {
  name: string;
  website: string;
  category: string;
  import_strategy?: ManufacturerImportStrategy;
  enabled?: boolean;
  auto_import?: boolean;
  import_frequency?: ManufacturerImportFrequency;
  brand?: string | null;
  logo_url?: string | null;
  aliases?: string[];
  country?: string | null;
  headquarters?: string | null;
  description?: string | null;
}
