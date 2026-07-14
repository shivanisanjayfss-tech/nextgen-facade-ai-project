import { importManufacturerProducts } from "@/services/manufacturer-import.service";
import {
  guardianGlassStrategy,
  GUARDIAN_GLASS_BASE,
  GUARDIAN_GLASS_CATALOGUE_URL,
  resolveGuardianGlassWebsiteUrl,
  isGuardianGlassProductPage,
} from "@/services/import-strategies";

export {
  GUARDIAN_GLASS_BASE,
  GUARDIAN_GLASS_CATALOGUE_URL,
  resolveGuardianGlassWebsiteUrl,
  isGuardianGlassProductPage,
};

export interface GuardianGlassImportOptions {
  websiteUrl?: string;
  category?: string;
  maxPages?: number;
  limit?: number;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export function isGuardianGlassManufacturer(manufacturer: string): boolean {
  return guardianGlassStrategy.matches(manufacturer);
}

export function buildGuardianGlassImportOptions(
  params: GuardianGlassImportOptions = {},
) {
  return guardianGlassStrategy.buildOptions({
    manufacturer: "Guardian Glass",
    websiteUrl: params.websiteUrl ?? GUARDIAN_GLASS_BASE,
    category: params.category ?? "Glass",
    maxPages: params.maxPages,
    limit: params.limit,
    timeoutMs: params.timeoutMs,
    pollIntervalMs: params.pollIntervalMs,
  });
}

/** Guardian Glass-specific import — uses GuardianGlassStrategy. */
export async function importGuardianGlassProducts(
  options: GuardianGlassImportOptions = {},
): Promise<ReturnType<typeof importManufacturerProducts>> {
  return importManufacturerProducts(buildGuardianGlassImportOptions(options));
}
