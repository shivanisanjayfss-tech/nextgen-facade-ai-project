export type {
  ManufacturerImportStrategy,
  StrategyBuildParams,
} from "@/services/import-strategies/types";

export { GenericStrategy, genericStrategy } from "@/services/import-strategies/generic.strategy";
export { AlucobondStrategy, alucobondStrategy } from "@/services/import-strategies/alucobond.strategy";
export {
  GuardianGlassStrategy,
  guardianGlassStrategy,
  GUARDIAN_GLASS_BASE,
  GUARDIAN_GLASS_CATALOGUE_URL,
  resolveGuardianGlassWebsiteUrl,
  isGuardianGlassProductPage,
} from "@/services/import-strategies/guardian-glass.strategy";
export {
  SaintGobainStrategy,
  saintGobainStrategy,
  SAINT_GOBAIN_GLASS_BASE,
  SAINT_GOBAIN_GLASS_CATALOGUE_URL,
  resolveSaintGobainWebsiteUrl,
  isSaintGobainProductPage,
  SAINT_GOBAIN_ENTRY_URLS,
  SAINT_GOBAIN_UK_ENTRY_URLS,
  getSaintGobainEntryUrls,
  buildSaintGobainIncludeGlobs,
} from "@/services/import-strategies/saint-gobain.strategy";
export { resolveImportStrategy } from "@/services/import-strategies/resolve-import-strategy";
