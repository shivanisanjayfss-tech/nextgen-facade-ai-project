/** Manufacturer entry used by the automatic import scheduler. */
export interface ScheduledManufacturer {
  manufacturer: string;
  url: string;
  category: string;
}

/**
 * Configured manufacturers for scheduled / run-all imports.
 * Extend this list to add new manufacturers without code changes elsewhere.
 */
export const SCHEDULED_MANUFACTURERS: ScheduledManufacturer[] = [
  {
    manufacturer: "Alucobond",
    url: "https://www.alucobond.com/en/products/",
    category: "ACP Sheet",
  },
  {
    manufacturer: "Guardian Glass",
    url: "https://www.guardianglass.com",
    category: "Glass",
  },
  {
    manufacturer: "AGC Glass",
    url: "https://www.agc-yourglass.com",
    category: "Glass",
  },
];
