import { agcGlassStrategy } from "@/services/import-strategies/agc-glass.strategy";
import { alucobondStrategy } from "@/services/import-strategies/alucobond.strategy";
import { genericStrategy } from "@/services/import-strategies/generic.strategy";
import { guardianGlassStrategy } from "@/services/import-strategies/guardian-glass.strategy";
import { mitsubishiChemicalStrategy } from "@/services/import-strategies/mitsubishi-chemical.strategy";
import { saintGobainStrategy } from "@/services/import-strategies/saint-gobain.strategy";
import type { ManufacturerImportStrategy } from "@/services/import-strategies/types";

/** Specific strategies checked before the generic fallback. */
const MANUFACTURER_STRATEGIES: ManufacturerImportStrategy[] = [
  alucobondStrategy,
  agcGlassStrategy,
  guardianGlassStrategy,
  mitsubishiChemicalStrategy,
  saintGobainStrategy,
];

const STRATEGY_BY_ID = new Map(
  MANUFACTURER_STRATEGIES.map((strategy) => [strategy.id, strategy]),
);

/** Resolves the import strategy from registry configuration or manufacturer name. */
export function resolveImportStrategy(
  manufacturer: string,
  strategyId?: string,
): ManufacturerImportStrategy {
  if (strategyId) {
    const configured = STRATEGY_BY_ID.get(strategyId);
    if (configured) return configured;
    if (strategyId === genericStrategy.id) return genericStrategy;
  }

  const match = MANUFACTURER_STRATEGIES.find((strategy) =>
    strategy.matches(manufacturer),
  );

  return match ?? genericStrategy;
}
