import { manufacturerSlug } from "@/lib/manufacturer-slug";
import { computeNextMonthlyRun } from "@/lib/next-scheduled-run";
import {
  formatAliasesForInput,
  normalizeWebsiteHost,
  parseAliasesInput,
} from "@/lib/manufacturer-identity";
import type { MaterialCategory } from "@/types/material";
import type {
  CreateManufacturerRegistryInput,
  ManufacturerImportFrequency,
  ManufacturerImportStrategy,
  UpdateManufacturerRegistryInput,
} from "@/types/manufacturer-registry";

/** Default values applied when creating a manufacturer registry row. */
export const MANUFACTURER_REGISTRY_DEFAULTS = {
  enabled: true,
  auto_import: true,
  import_frequency: "monthly" as ManufacturerImportFrequency,
  import_strategy: "generic" as ManufacturerImportStrategy,
};

/** Supported import strategies for the admin form dropdown. */
export const MANUFACTURER_IMPORT_STRATEGIES: ManufacturerImportStrategy[] = [
  "generic",
  "alucobond",
  "agc-glass",
  "guardian-glass",
  "mitsubishi-chemical",
  "saint-gobain",
];

export interface ManufacturerRegistryFormValues {
  name: string;
  website: string;
  category: MaterialCategory | string;
  import_strategy: ManufacturerImportStrategy;
  enabled: boolean;
  auto_import: boolean;
  import_frequency: ManufacturerImportFrequency;
  brand?: string | null;
  aliases?: string;
  country?: string | null;
  headquarters?: string | null;
  description?: string | null;
  logo_url?: string | null;
}

export function createEmptyManufacturerFormValues(): ManufacturerRegistryFormValues {
  return {
    name: "",
    website: "",
    category: "ACP Sheet",
    import_strategy: MANUFACTURER_REGISTRY_DEFAULTS.import_strategy,
    enabled: MANUFACTURER_REGISTRY_DEFAULTS.enabled,
    auto_import: MANUFACTURER_REGISTRY_DEFAULTS.auto_import,
    import_frequency: MANUFACTURER_REGISTRY_DEFAULTS.import_frequency,
    brand: null,
    aliases: "",
    country: null,
    headquarters: null,
    description: null,
    logo_url: null,
  };
}

export function formValuesFromRegistryRow(
  row: ManufacturerRegistryRowLike,
): ManufacturerRegistryFormValues {
  return {
    name: row.name,
    website: row.website,
    category: row.category,
    import_strategy: row.import_strategy,
    enabled: row.enabled,
    auto_import: row.auto_import,
    import_frequency: enforceMonthlyFrequency(row.import_frequency),
    brand: row.brand,
    aliases: formatAliasesForInput(row.aliases),
    country: row.country,
    headquarters: row.headquarters,
    description: row.description,
    logo_url: row.logo_url,
  };
}

interface ManufacturerRegistryRowLike {
  name: string;
  website: string;
  category: string;
  import_strategy: ManufacturerImportStrategy;
  enabled: boolean;
  auto_import: boolean;
  import_frequency: ManufacturerImportFrequency;
  brand: string | null;
  aliases?: string[] | null;
  country: string | null;
  headquarters: string | null;
  description: string | null;
  logo_url: string | null;
}

/** Phase 1: monthly scheduling only — weekly/daily deferred. */
export function enforceMonthlyFrequency(
  _frequency?: ManufacturerImportFrequency,
): ManufacturerImportFrequency {
  return MANUFACTURER_REGISTRY_DEFAULTS.import_frequency;
}

export function normalizeWebsiteUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function buildCreateManufacturerPayload(
  input: CreateManufacturerRegistryInput,
): Record<string, unknown> {
  const name = input.name.trim();
  const website = normalizeWebsiteUrl(input.website);
  const now = new Date().toISOString();
  const nextImportAt = computeNextMonthlyRun();
  const aliases = input.aliases ?? [];

  return {
    name,
    slug: manufacturerSlug(name),
    website,
    website_host: normalizeWebsiteHost(website),
    aliases,
    category: input.category.trim(),
    brand: input.brand?.trim() || null,
    country: input.country?.trim() || null,
    headquarters: input.headquarters?.trim() || null,
    description: input.description?.trim() || null,
    logo_url: input.logo_url?.trim() || null,
    enabled: input.enabled ?? MANUFACTURER_REGISTRY_DEFAULTS.enabled,
    auto_import: input.auto_import ?? MANUFACTURER_REGISTRY_DEFAULTS.auto_import,
    import_frequency: enforceMonthlyFrequency(input.import_frequency),
    import_strategy:
      input.import_strategy ?? MANUFACTURER_REGISTRY_DEFAULTS.import_strategy,
    next_import_at: nextImportAt.toISOString(),
    total_products: 0,
    created_at: now,
    updated_at: now,
  };
}

export function buildUpdateManufacturerPayload(
  input: UpdateManufacturerRegistryInput,
): UpdateManufacturerRegistryInput {
  const payload: UpdateManufacturerRegistryInput = {
    ...input,
    import_frequency: enforceMonthlyFrequency(input.import_frequency),
  };

  if (input.name !== undefined) {
    payload.name = input.name.trim();
  }

  if (input.website !== undefined) {
    payload.website = normalizeWebsiteUrl(input.website);
    payload.website_host = normalizeWebsiteHost(payload.website);
  }

  if (input.aliases !== undefined) {
    payload.aliases = input.aliases;
  }

  if (input.category !== undefined) {
    payload.category = input.category.trim();
  }

  if (input.brand !== undefined) {
    payload.brand = input.brand?.trim() || null;
  }

  if (input.country !== undefined) {
    payload.country = input.country?.trim() || null;
  }

  if (input.headquarters !== undefined) {
    payload.headquarters = input.headquarters?.trim() || null;
  }

  if (input.description !== undefined) {
    payload.description = input.description?.trim() || null;
  }

  if (input.logo_url !== undefined) {
    payload.logo_url = input.logo_url?.trim() || null;
  }

  return payload;
}

export function validateManufacturerFormValues(
  values: Pick<ManufacturerRegistryFormValues, "name" | "website" | "category">,
): string | null {
  if (!values.name.trim()) return "Manufacturer name is required.";
  if (!values.website.trim()) return "Website is required.";
  if (!values.category.trim()) return "Category is required.";

  try {
    const url = new URL(normalizeWebsiteUrl(values.website));
    if (!url.hostname) return "Website must be a valid URL.";
  } catch {
    return "Website must be a valid URL.";
  }

  return null;
}

export function formValuesToCreateInput(
  values: ManufacturerRegistryFormValues,
): CreateManufacturerRegistryInput {
  return {
    name: values.name,
    website: values.website,
    category: values.category,
    import_strategy: values.import_strategy,
    enabled: values.enabled,
    auto_import: values.auto_import,
    import_frequency: enforceMonthlyFrequency(values.import_frequency),
    brand: values.brand,
    aliases: parseAliasesInput(values.aliases ?? ""),
    country: values.country,
    headquarters: values.headquarters,
    description: values.description,
    logo_url: values.logo_url,
  };
}

export function formValuesToUpdateInput(
  values: ManufacturerRegistryFormValues,
): UpdateManufacturerRegistryInput {
  return buildUpdateManufacturerPayload({
    ...formValuesToCreateInput(values),
    aliases: parseAliasesInput(values.aliases ?? ""),
  });
}
