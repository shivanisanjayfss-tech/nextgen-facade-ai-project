import { alucobondStrategy } from "@/services/import-strategies/alucobond.strategy";
import { genericStrategy } from "@/services/import-strategies/generic.strategy";
import { guardianGlassStrategy } from "@/services/import-strategies/guardian-glass.strategy";
import { saintGobainStrategy } from "@/services/import-strategies/saint-gobain.strategy";
import type { ManufacturerImportStrategy } from "@/services/import-strategies/types";

/** Specific strategies checked before the generic fallback. */
const MANUFACTURER_STRATEGIES: ManufacturerImportStrategy[] = [
  alucobondStrategy,
  guardianGlassStrategy,
  saintGobainStrategy,
];

/** Resolves the import strategy for a manufacturer name. */
export function resolveImportStrategy(
  manufacturer: string,
): ManufacturerImportStrategy {
  const match = MANUFACTURER_STRATEGIES.find((strategy) =>
    strategy.matches(manufacturer),
  );

  return match ?? genericStrategy;
}
