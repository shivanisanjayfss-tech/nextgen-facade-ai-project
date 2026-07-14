import type { ImportLimits } from "@/services/import-limits";
import type { ManufacturerImportOptions } from "@/services/manufacturer-import.service";
import type {
  ManufacturerImportStrategy,
  StrategyBuildParams,
} from "@/services/import-strategies/types";

export class GenericStrategy implements ManufacturerImportStrategy {
  readonly id = "generic";
  readonly displayName = "Generic";

  matches(): boolean {
    return true;
  }

  getImportLimits(): ImportLimits {
    return { maxPages: 30, limit: 30, timeout: 60_000 };
  }

  buildOptions(params: StrategyBuildParams): ManufacturerImportOptions {
    const limits = this.getImportLimits();

    return {
      manufacturer: params.manufacturer,
      websiteUrl: params.websiteUrl,
      category: params.category,
      maxPages: params.maxPages ?? limits.maxPages,
      limit: params.limit ?? limits.limit,
      timeoutMs: params.timeoutMs ?? limits.timeout,
      pollIntervalMs: params.pollIntervalMs ?? 2_000,
    };
  }
}

export const genericStrategy = new GenericStrategy();
