import { parseMaterialSpecs } from "@/lib/material-specs";
import { normalizeGalleryImageUrls, normalizeProductImageUrl, pickBestProductImageUrl, resolveRelativeProductImageUrl } from "@/lib/product-image-url";
import type { Material, MaterialSummary, ProductType } from "@/types";

function getSpecsRecord(material: Material): Record<string, unknown> {
  return parseMaterialSpecs(material.specs);
}

const PRODUCT_DETAIL_DOWNLOAD_LABELS = new Set([
  "Datasheet",
  "Brochure",
  "Installation Guide",
  "Maintenance Guide",
]);

/** Known spec keys mapped to consultancy-friendly labels. */
const SPEC_LABELS: Record<string, string> = {
  fireRating: "Fire Rating",
  thickness: "Thickness",
  dimensions: "Available Sizes",
  availableSizes: "Available Sizes",
  width: "Width",
  length: "Length",
  weight: "Weight",
  panelWeight: "Panel Weight",
  coreMaterial: "Core Material",
  coating: "Coating",
  finish: "Finish",
  surface: "Surface",
  density: "Density",
  warranty: "Warranty",
  weatherResistance: "Weather Resistance",
  uvResistance: "UV Resistance",
  thermalConductivity: "Thermal Conductivity",
  windLoad: "Wind Load",
  uValue: "U Value",
  solarFactor: "Solar Factor",
  visibleLightTransmission: "Visible Light Transmission",
  lightTransmission: "Visible Light Transmission",
  acousticRating: "Acoustic Rating",
  soundReduction: "Acoustic Rating",
  impactResistance: "Impact Resistance",
  solarHeatGain: "Solar Factor",
  glassType: "Glass Type",
  edgeFinish: "Edge Finish",
  shgc: "SHGC",
  emissivity: "Emissivity",
  selectivity: "Selectivity",
  reflectance: "Reflectance",
};

const COLOR_SPEC_KEYS = [
  "colors",
  "colours",
  "colorOptions",
  "colourOptions",
  "availableColours",
  "availableColors",
] as const;

const DOWNLOAD_DEFINITIONS = [
  { label: "Datasheet", keys: ["datasheetUrl", "datasheet", "datasheet_url"] },
  { label: "Brochure", keys: ["brochureUrl", "brochure", "brochure_url"] },
  {
    label: "Installation Guide",
    keys: [
      "installationGuideUrl",
      "installationGuide",
      "installation_guide",
      "installation_guide_url",
    ],
  },
  {
    label: "Technical Manual",
    keys: ["technicalManualUrl", "technicalManual", "technical_manual"],
  },
  {
    label: "Maintenance Guide",
    keys: [
      "maintenanceGuideUrl",
      "maintenanceGuide",
      "maintenance_guide",
      "maintenance_guide_url",
    ],
  },
  {
    label: "Certificates",
    keys: ["certificatesUrl", "certificateUrl", "certificates", "certificate"],
  },
] as const;

const REFERENCE_IMAGE_SPEC_KEYS = [
  "referenceImages",
  "reference_images",
  "referencePhotos",
  "reference_photos",
] as const;

const FEATURE_SPEC_KEYS = [
  "features",
  "keyFeatures",
  "key_features",
  "productFeatures",
  "product_features",
  "benefits",
  "highlights",
] as const;

const APPLICATION_SPEC_KEYS = [
  "applications",
  "application",
  "applicationAreas",
  "application_areas",
  "uses",
] as const;

const CERTIFICATION_SPEC_KEYS = [
  "certifications",
  "certification",
  "certificates",
  "certificate",
  "approvals",
  "approval",
] as const;

const IMAGE_SPEC_KEYS = [
  "galleryImages",
  "images",
  "additionalImages",
  "additional_images",
  "gallery",
  "imageUrls",
  "image_urls",
] as const;

const MANUFACTURER_SPEC_KEYS = {
  website: ["manufacturerWebsite", "manufacturer_website", "website", "companyWebsite"],
  country: ["manufacturerCountry", "manufacturer_country", "country"],
  description: [
    "manufacturerDescription",
    "manufacturer_description",
    "companyDescription",
    "company_description",
  ],
} as const;

/** Product detail message when no technical specification data exists. */
export const TECHNICAL_SPECS_UNAVAILABLE_MESSAGE =
  "Technical specifications are not available for this product yet.";

export type SpecSectionId =
  | "general"
  | "physical"
  | "performance"
  | "glass"
  | "surface"
  | "standards"
  | "commercial";

export interface TechnicalSpecRow {
  key: string;
  label: string;
  value: string;
  href?: string;
}

export interface TechnicalSpecSection {
  id: SpecSectionId;
  title: string;
  entries: TechnicalSpecRow[];
}

export interface TechnicalSpecifications {
  sections: TechnicalSpecSection[];
  hasDetailedSpecs: boolean;
  datasheetUrl?: string;
}

/** @deprecated Use TechnicalSpecRow with grouped sections instead. */
export type SpecCategory =
  | "fire"
  | "physical"
  | "thermal"
  | "optical"
  | "acoustic"
  | "mechanical"
  | "durability"
  | "compliance";

/** @deprecated Use TechnicalSpecRow with grouped sections instead. */
export interface SpecEntry {
  key: string;
  label: string;
  value: string;
  category: SpecCategory;
}

type MaterialFieldKey = "name" | "manufacturer" | "brand" | "category";

interface SpecFieldDefinition {
  label: string;
  keys?: readonly string[];
  materialField?: MaterialFieldKey;
  colorList?: boolean;
  url?: boolean;
  materialUrlField?: "datasheetUrl";
}

interface SpecSectionDefinition {
  id: SpecSectionId;
  title: string;
  fields: readonly SpecFieldDefinition[];
}

const TECHNICAL_SPEC_SECTIONS: readonly SpecSectionDefinition[] = [
  {
    id: "general",
    title: "General",
    fields: [
      {
        label: "Product Family",
        keys: ["productFamily", "product_family", "family", "productLine", "product_line"],
      },
      {
        label: "Country of Origin",
        keys: [
          "countryOfOrigin",
          "country_of_origin",
          "manufacturerCountry",
          "manufacturer_country",
          "country",
        ],
      },
      {
        label: "Glass Type",
        keys: ["glassType", "glass_type"],
      },
    ],
  },
  {
    id: "physical",
    title: "Physical",
    fields: [
      { label: "Thickness", keys: ["thickness"] },
      { label: "Width", keys: ["width", "standardWidth", "standard_width"] },
      { label: "Length", keys: ["length", "standardLength", "standard_length"] },
      {
        label: "Standard Sizes",
        keys: [
          "standardSizes",
          "standard_sizes",
          "dimensions",
          "availableSizes",
          "available_sizes",
          "panelSize",
          "panel_size",
        ],
      },
      { label: "Weight", keys: ["weight", "panelWeight", "panel_weight"] },
      { label: "Density", keys: ["density"] },
      {
        label: "Aluminium Skin Thickness",
        keys: [
          "aluminiumSkinThickness",
          "aluminium_skin_thickness",
          "aluminiumThickness",
          "aluminium_thickness",
          "aluminumThickness",
          "aluminum_thickness",
        ],
      },
      { label: "Core Material", keys: ["coreMaterial", "core_material"] },
    ],
  },
  {
    id: "performance",
    title: "Performance",
    fields: [
      { label: "Fire Rating", keys: ["fireRating", "fire_rating"] },
      { label: "Weather Resistance", keys: ["weatherResistance", "weather_resistance"] },
      { label: "UV Resistance", keys: ["uvResistance", "uv_resistance"] },
      { label: "Impact Resistance", keys: ["impactResistance", "impact_resistance"] },
      {
        label: "Wind Load Resistance",
        keys: ["windLoadResistance", "wind_load_resistance", "windLoad", "wind_load"],
      },
      {
        label: "Thermal Conductivity",
        keys: ["thermalConductivity", "thermal_conductivity"],
      },
      { label: "Thermal Expansion", keys: ["thermalExpansion", "thermal_expansion"] },
      {
        label: "Acoustic Rating",
        keys: ["acousticRating", "acoustic_rating", "soundReduction", "sound_reduction"],
      },
      { label: "Water Absorption", keys: ["waterAbsorption", "water_absorption"] },
    ],
  },
  {
    id: "glass",
    title: "Glass-specific",
    fields: [
      { label: "U-Value", keys: ["uValue", "u_value", "u-value"] },
      {
        label: "SHGC",
        keys: [
          "shgc",
          "solarHeatGainCoefficient",
          "solar_heat_gain_coefficient",
          "solarHeatGain",
          "solar_heat_gain",
        ],
      },
      {
        label: "Visible Light Transmission",
        keys: [
          "visibleLightTransmission",
          "visible_light_transmission",
          "lightTransmission",
          "light_transmission",
          "vlt",
        ],
      },
      { label: "Solar Factor", keys: ["solarFactor", "solar_factor"] },
      { label: "Reflectance", keys: ["reflectance", "lightReflectance", "light_reflectance"] },
    ],
  },
  {
    id: "surface",
    title: "Surface",
    fields: [
      { label: "Coating", keys: ["coating"] },
      { label: "Edge Finish", keys: ["edgeFinish", "edge_finish"] },
    ],
  },
  {
    id: "standards",
    title: "Standards",
    fields: [
      { label: "Certifications", keys: ["certifications", "certification", "certificates"] },
      { label: "ASTM", keys: ["astm", "astmStandards", "astm_standards"] },
      { label: "EN", keys: ["en", "enStandards", "en_standards"] },
      { label: "ISO", keys: ["iso", "isoStandards", "iso_standards"] },
    ],
  },
  {
    id: "commercial",
    title: "Commercial",
    fields: [
      { label: "Warranty", keys: ["warranty"] },
      {
        label: "Datasheet",
        keys: ["datasheetUrl", "datasheet", "datasheet_url"],
        url: true,
        materialUrlField: "datasheetUrl",
      },
      { label: "Brochure", keys: ["brochureUrl", "brochure", "brochure_url"], url: true },
      {
        label: "Installation Guide",
        keys: [
          "installationGuideUrl",
          "installationGuide",
          "installation_guide",
          "installation_guide_url",
        ],
        url: true,
      },
      {
        label: "Technical Manual",
        keys: ["technicalManualUrl", "technicalManual", "technical_manual"],
        url: true,
      },
    ],
  },
] as const;

/**
 * Appearance / finish fields shown in a dedicated section so they render for
 * Colour Series products even when no engineering specifications exist.
 */
const APPEARANCE_SPEC_FIELDS: readonly SpecFieldDefinition[] = [
  { label: "Finish", keys: ["finish", "surfaceFinish", "surface_finish"] },
  { label: "Surface", keys: ["surface", "surfaceType", "surface_type"] },
  {
    label: "Colour Series",
    keys: ["colourSeries", "colour_series", "colorSeries", "color_series"],
  },
  { label: "Colour Range", keys: COLOR_SPEC_KEYS, colorList: true },
  { label: "Gloss Level", keys: ["glossLevel", "gloss_level", "gloss"] },
] as const;

const APPEARANCE_SPEC_KEYS = new Set(
  APPEARANCE_SPEC_FIELDS.flatMap((field) => field.keys ?? []),
);

const CANONICAL_SPEC_KEYS = new Set([
  ...TECHNICAL_SPEC_SECTIONS.flatMap((section) =>
    section.fields.flatMap((field) => field.keys ?? []),
  ),
  ...APPEARANCE_SPEC_KEYS,
]);

export interface DownloadLink {
  label: string;
  url: string;
}

export interface ColorSwatch {
  name: string;
  hex?: string;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface ManufacturerProfile {
  name: string;
  website?: string;
  country?: string;
  description?: string;
  productCount?: number;
}

const EXCLUDED_SPEC_KEYS = new Set<string>([
  ...COLOR_SPEC_KEYS,
  ...IMAGE_SPEC_KEYS,
  ...MANUFACTURER_SPEC_KEYS.website,
  ...MANUFACTURER_SPEC_KEYS.country,
  ...MANUFACTURER_SPEC_KEYS.description,
  ...DOWNLOAD_DEFINITIONS.flatMap((item) => item.keys),
  "brochureUrl",
  "installationGuideUrl",
  "technicalManualUrl",
  "maintenanceGuideUrl",
  "datasheet",
  "datasheetUrl",
  "datasheet_url",
  "brand",
  "colourSeries",
  "inheritedFrom",
  "inheritSpecsFromSlug",
  "productType",
  ...APPEARANCE_SPEC_KEYS,
  ...REFERENCE_IMAGE_SPEC_KEYS,
  ...FEATURE_SPEC_KEYS,
  ...APPLICATION_SPEC_KEYS,
  ...CERTIFICATION_SPEC_KEYS,
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Resolves the primary product image URL from mapped material fields. */
export function resolveMaterialImageUrl(
  material: Pick<Material, "imageUrl" | "specs" | "sourceUrl"> & {
    image_url?: string | null;
  },
): string | null {
  const galleryImages = getGalleryImageUrls(material as Material);

  return pickBestProductImageUrl(
    material.imageUrl ?? material.image_url ?? null,
    galleryImages,
  );
}

function formatSpecLabel(key: string): string {
  if (SPEC_LABELS[key]) return SPEC_LABELS[key];

  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatSpecValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (Array.isArray(value)) {
    const items = value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (typeof item === "number" && Number.isFinite(item)) return String(item);
        if (typeof item === "boolean") return item ? "Yes" : "No";
        return String(item);
      })
      .filter(Boolean);
    return items.length > 0 ? items.join(", ") : null;
  }
  if (typeof value === "object") return null;

  const text = String(value).trim();
  return text || null;
}

function formatColorListValue(value: unknown): string | null {
  if (!Array.isArray(value)) return formatSpecValue(value);

  const names = value
    .map(parseColorEntry)
    .filter((entry): entry is ColorSwatch => entry !== null)
    .map((entry) => entry.name);

  return names.length > 0 ? names.join(", ") : null;
}

function resolveMaterialFieldValue(material: Material, field: MaterialFieldKey): string | null {
  const value = material[field];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function resolveSpecTextValue(
  specs: Record<string, unknown>,
  keys: readonly string[],
  colorList = false,
): string | null {
  for (const key of keys) {
    const value = specs[key];
    if (value === null || value === undefined) continue;

    const formatted = colorList ? formatColorListValue(value) : formatSpecValue(value);
    if (formatted) return formatted;
  }

  return null;
}

function resolveSpecUrlValue(
  material: Material,
  specs: Record<string, unknown>,
  field: SpecFieldDefinition,
): TechnicalSpecRow | null {
  const keys = field.keys ?? [];
  let url: string | undefined;

  if (field.materialUrlField === "datasheetUrl" && material.datasheetUrl) {
    url = material.datasheetUrl.trim();
  }

  if (!url) {
    url = findSpecUrl(specs, keys);
  }

  if (!url) return null;

  return {
    key: keys[0] ?? field.label,
    label: field.label,
    value: "View document",
    href: url,
  };
}

function resolveSpecField(
  material: Material,
  specs: Record<string, unknown>,
  field: SpecFieldDefinition,
): TechnicalSpecRow | null {
  if (field.materialField) {
    const value = resolveMaterialFieldValue(material, field.materialField);
    if (!value) return null;
    return { key: field.materialField, label: field.label, value };
  }

  if (field.url) {
    return resolveSpecUrlValue(material, specs, field);
  }

  const keys = field.keys;
  if (!keys) return null;

  const value = resolveSpecTextValue(specs, keys, field.colorList);
  if (!value) return null;

  const key =
    keys.find((candidate) => {
      const candidateValue = specs[candidate];
      if (candidateValue === null || candidateValue === undefined) return false;
      const formatted = field.colorList
        ? formatColorListValue(candidateValue)
        : formatSpecValue(candidateValue);
      return Boolean(formatted);
    }) ?? keys[0];

  return { key, label: field.label, value };
}

function resolveAdditionalSpecRows(
  specs: Record<string, unknown>,
  usedKeys: Set<string>,
): TechnicalSpecRow[] {
  return Object.entries(specs)
    .filter(
      ([key]) =>
        !EXCLUDED_SPEC_KEYS.has(key) && !usedKeys.has(key) && !CANONICAL_SPEC_KEYS.has(key),
    )
    .map(([key, value]) => {
      const formatted = formatSpecValue(value);
      if (!formatted) return null;
      usedKeys.add(key);
      return {
        key,
        label: formatSpecLabel(key),
        value: formatted,
      };
    })
    .filter((entry): entry is TechnicalSpecRow => entry !== null)
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Builds grouped technical specification sections for the product detail page. */
export function getTechnicalSpecifications(material: Material): TechnicalSpecifications {
  const specs = getSpecsRecord(material);
  const usedKeys = new Set<string>();
  const sections: TechnicalSpecSection[] = [];

  for (const sectionDefinition of TECHNICAL_SPEC_SECTIONS) {
    const entries: TechnicalSpecRow[] = [];

    for (const field of sectionDefinition.fields) {
      const row = resolveSpecField(material, specs, field);
      if (!row) continue;

      if (field.keys) {
        const matchedKey = field.keys.find((candidate) => {
          const candidateValue = specs[candidate];
          if (candidateValue === null || candidateValue === undefined) return false;
          if (field.colorList) return formatColorListValue(candidateValue) !== null;
          if (field.url) return isNonEmptyString(candidateValue);
          return formatSpecValue(candidateValue) !== null;
        });
        if (matchedKey) usedKeys.add(matchedKey);
      }

      entries.push(row);
    }

    if (sectionDefinition.id === "physical") {
      entries.push(...resolveAdditionalSpecRows(specs, usedKeys));
    }

    if (entries.length > 0) {
      sections.push({
        id: sectionDefinition.id,
        title: sectionDefinition.title,
        entries,
      });
    }
  }

  const hasDetailedSpecs = sections.some((section) => section.entries.length > 0);

  return {
    sections,
    hasDetailedSpecs,
    datasheetUrl: getDatasheetUrl(material),
  };
}

/** Resolves the catalogue product type — persisted, else inferred for legacy rows. */
export function getProductType(material: Material): ProductType {
  const specs = getSpecsRecord(material);
  const raw =
    typeof specs.productType === "string" ? specs.productType.trim().toLowerCase() : "";

  if (raw === "colour series" || raw === "color series") return "Colour Series";
  if (raw === "product family") return "Product Family";
  if (raw === "product") return "Product";

  // Backward compatibility for rows imported before productType was persisted.
  if (isNonEmptyString(specs.colourSeries)) return "Colour Series";
  if (isNonEmptyString(material.sourceUrl) && /colou?r-series/i.test(material.sourceUrl)) {
    return "Colour Series";
  }

  return "Product";
}

/**
 * Builds the appearance / finish section (Finish, Surface, Colour Series,
 * Colour Range, Gloss). Kept separate from Technical Specifications so it
 * renders for Colour Series products that have no engineering specs.
 * Colour Range is omitted when colour swatches already render separately.
 */
export function getAppearanceSpecifications(material: Material): TechnicalSpecifications {
  const specs = getSpecsRecord(material);
  const hasSwatches = getMaterialColours(material).length > 0;
  const entries: TechnicalSpecRow[] = [];

  for (const field of APPEARANCE_SPEC_FIELDS) {
    if (field.label === "Colour Range" && hasSwatches) continue;

    const row = resolveSpecField(material, specs, field);
    if (row) entries.push(row);
  }

  const sections: TechnicalSpecSection[] =
    entries.length > 0 ? [{ id: "surface", title: "Finish & Surface", entries }] : [];

  return { sections, hasDetailedSpecs: entries.length > 0 };
}

/** Returns gallery images excluding the primary hero image. */
export function getAdditionalGalleryImages(material: Material): string[] {
  const primary = resolveMaterialImageUrl(material);
  const gallery = getGalleryImageUrls(material);

  if (!primary) return gallery;
  return gallery.filter((url) => url !== primary);
}

/** Returns normalized gallery image URLs from specs JSON. */
export function getGalleryImageUrls(material: Material): string[] {
  const specs = getSpecsRecord(material);
  const urls: string[] = [];
  const baseUrl = material.sourceUrl ?? null;

  for (const key of IMAGE_SPEC_KEYS) {
    const value = specs[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isNonEmptyString(item)) {
          urls.push(
            resolveRelativeProductImageUrl(item, baseUrl) ??
              normalizeProductImageUrl(item) ??
              item,
          );
        }
      }
    } else if (isNonEmptyString(value)) {
      urls.push(
        resolveRelativeProductImageUrl(value, baseUrl) ??
          normalizeProductImageUrl(value) ??
          value,
      );
    }
  }

  return normalizeGalleryImageUrls(urls);
}

/** Returns reference / application images when stored separately from the gallery. */
export function getReferenceImages(material: Material): string[] {
  const specs = getSpecsRecord(material);
  const urls: string[] = [];

  for (const key of REFERENCE_IMAGE_SPEC_KEYS) {
    const value = specs[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isNonEmptyString(item)) urls.push(item);
      }
    } else if (isNonEmptyString(value)) {
      urls.push(value);
    }
  }

  return normalizeGalleryImageUrls(urls);
}

/** Returns the brochure download URL when present in specs. */
export function getBrochureUrl(material: Material): string | null {
  const url = findSpecUrl(getSpecsRecord(material), ["brochureUrl", "brochure", "brochure_url"]);
  return url?.trim() ?? null;
}

/** Returns the installation guide download URL when present in specs. */
export function getInstallationGuideUrl(material: Material): string | null {
  const url = findSpecUrl(getSpecsRecord(material), [
    "installationGuideUrl",
    "installationGuide",
    "installation_guide",
    "installation_guide_url",
  ]);
  return url ? url.trim() : null;
}

/** Returns the manufacturer company website derived from Supabase data. */
export function getManufacturerCompanyWebsite(material: Material): string | null {
  const website = resolveManufacturerWebsite(material, getSpecsRecord(material));
  return website ?? null;
}

/** True when the manufacturer profile has more than just the company name. */
export function hasExtendedManufacturerProfile(profile: ManufacturerProfile): boolean {
  return Boolean(
    profile.website ||
      profile.country ||
      profile.description ||
      (typeof profile.productCount === "number" && profile.productCount > 0),
  );
}

/** Extracts displayable technical properties from material specs JSON. */
export function getMaterialSpecEntries(material: Material): SpecEntry[] {
  const { sections } = getTechnicalSpecifications(material);

  return sections.flatMap((section) =>
    section.entries.map((entry) => ({
      key: entry.key,
      label: entry.label,
      value: entry.value,
      category: mapSectionToLegacyCategory(section.id),
    })),
  );
}

function mapSectionToLegacyCategory(sectionId: SpecSectionId): SpecCategory {
  switch (sectionId) {
    case "performance":
      return "fire";
    case "glass":
      return "optical";
    case "standards":
    case "commercial":
      return "compliance";
    case "surface":
      return "durability";
    default:
      return "physical";
  }
}

function findSpecUrl(specs: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = specs[key];
    if (isNonEmptyString(value)) return value.trim();
  }
  return undefined;
}

function findSpecText(specs: Record<string, unknown>, keys: readonly string[]): string | undefined {
  return findSpecUrl(specs, keys);
}

function collectImageUrls(
  material: Material,
  specs: Record<string, unknown>,
): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();

  const add = (url?: string | null) => {
    const normalized = normalizeProductImageUrl(url);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    ordered.push(normalized);
  };

  add(resolveMaterialImageUrl(material));

  for (const key of IMAGE_SPEC_KEYS) {
    const value = specs[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isNonEmptyString(item)) add(item);
      }
    } else if (isNonEmptyString(value)) {
      add(value);
    }
  }

  for (const [key, value] of Object.entries(specs)) {
    if (REFERENCE_IMAGE_SPEC_KEYS.includes(key as (typeof REFERENCE_IMAGE_SPEC_KEYS)[number])) {
      continue;
    }
    if (!/image|photo|picture/i.test(key)) continue;
    if (isNonEmptyString(value)) add(value);
  }

  return ordered;
}

function parseColorEntry(item: unknown): ColorSwatch | null {
  if (typeof item === "string") {
    const trimmed = item.trim();
    if (!trimmed) return null;

    const hexMatch = trimmed.match(/#([0-9a-fA-F]{6})/);
    const name = trimmed.replace(/#[0-9a-fA-F]{6}/, "").trim() || trimmed;

    return {
      name,
      hex: hexMatch ? `#${hexMatch[1]}` : undefined,
    };
  }

  if (typeof item === "object" && item !== null) {
    const record = item as Record<string, unknown>;
    const name = String(record.name ?? record.label ?? record.colour ?? record.color ?? "")
      .trim();
    if (!name) return null;

    const hexCandidate = record.hex ?? record.color ?? record.value;
    const hex =
      typeof hexCandidate === "string" && /^#[0-9a-fA-F]{6}$/.test(hexCandidate)
        ? hexCandidate
        : undefined;

    return { name, hex };
  }

  return null;
}

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 35% 42%)`;
}

/** Truncates description for hero display. */
export function getShortDescription(description: string, maxLength = 220): string {
  const trimmed = description.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

/** Returns colour swatches when colour data exists in specs. */
export function getMaterialColours(material: Material): ColorSwatch[] {
  const specs = getSpecsRecord(material);

  for (const key of COLOR_SPEC_KEYS) {
    const value = specs[key];
    if (!Array.isArray(value)) continue;

    const swatches = value
      .map(parseColorEntry)
      .filter((entry): entry is ColorSwatch => entry !== null);

    if (swatches.length > 0) return swatches;
  }

  return [];
}

/** Returns a stable fallback colour for swatches without hex values. */
export function getSwatchBackground(swatch: ColorSwatch): string {
  return swatch.hex ?? hashColor(swatch.name);
}

/** Returns the key product features / benefits list from specs, if present. */
export function getMaterialFeatures(material: Material): string[] {
  const specs = getSpecsRecord(material);
  const features: string[] = [];
  const seen = new Set<string>();

  for (const key of FEATURE_SPEC_KEYS) {
    const value = specs[key];
    const items = Array.isArray(value)
      ? value
      : isNonEmptyString(value)
        ? value.split(/\r?\n|•|;\s+/)
        : [];

    for (const item of items) {
      if (!isNonEmptyString(item)) continue;
      const text = item.trim();
      const dedupeKey = text.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      features.push(text);
    }

    if (features.length > 0) break;
  }

  return features;
}

function collectSpecListItems(
  specs: Record<string, unknown>,
  keys: readonly string[],
): string[] {
  const items: string[] = [];
  const seen = new Set<string>();

  for (const key of keys) {
    const value = specs[key];
    const candidates = Array.isArray(value)
      ? value
      : isNonEmptyString(value)
        ? value.split(/\r?\n|•|;\s+/)
        : [];

    for (const item of candidates) {
      if (!isNonEmptyString(item)) continue;
      const text = item.trim();
      const dedupeKey = text.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      items.push(text);
    }

    if (items.length > 0) break;
  }

  return items;
}

/** Returns application areas extracted from manufacturer page content. */
export function getMaterialApplications(material: Material): string[] {
  return collectSpecListItems(getSpecsRecord(material), APPLICATION_SPEC_KEYS);
}

/** Returns certifications / standards extracted from manufacturer page content. */
export function getMaterialCertifications(material: Material): string[] {
  return collectSpecListItems(getSpecsRecord(material), CERTIFICATION_SPEC_KEYS);
}

/** Returns available download links for a material. */
export function getMaterialDownloads(material: Material): DownloadLink[] {
  const specs = getSpecsRecord(material);
  const downloads: DownloadLink[] = [];
  const seen = new Set<string>();

  if (material.datasheetUrl) {
    downloads.push({ label: "Datasheet", url: material.datasheetUrl });
    seen.add(material.datasheetUrl);
  }

  for (const definition of DOWNLOAD_DEFINITIONS) {
    if (definition.label === "Datasheet") continue;

    const url = findSpecUrl(specs, definition.keys);
    if (!url || seen.has(url)) continue;

    downloads.push({ label: definition.label, url });
    seen.add(url);
  }

  return downloads;
}

/** Returns product-detail download links in the consultant-facing set. */
export function getProductDetailDownloads(material: Material): DownloadLink[] {
  return getMaterialDownloads(material).filter((download) =>
    PRODUCT_DETAIL_DOWNLOAD_LABELS.has(download.label),
  );
}

/** Returns the primary datasheet URL if available. */
export function getDatasheetUrl(material: Material): string | undefined {
  return getMaterialDownloads(material).find((item) => item.label === "Datasheet")?.url;
}

/** Returns all unique product image URLs. */
export function getMaterialImages(material: Material): string[] {
  return collectImageUrls(material, getSpecsRecord(material));
}

/** Returns all product images with the Supabase imageUrl first. */
export function getProductDetailImages(material: Material): string[] {
  return getMaterialImages(material);
}

function resolveManufacturerWebsite(material: Material, specs: Record<string, unknown>): string | undefined {
  const fromSpecs = findSpecUrl(specs, MANUFACTURER_SPEC_KEYS.website);
  if (fromSpecs) return fromSpecs;

  if (material.sourceUrl) {
    try {
      const url = new URL(material.sourceUrl);
      return url.origin;
    } catch {
      return material.sourceUrl;
    }
  }

  return undefined;
}

/** Builds manufacturer profile from material and specs data. */
export function getManufacturerProfile(
  material: Material,
  productCount?: number,
): ManufacturerProfile {
  const specs = getSpecsRecord(material);

  return {
    name: material.manufacturer,
    website: resolveManufacturerWebsite(material, specs),
    country: findSpecText(specs, MANUFACTURER_SPEC_KEYS.country),
    description: findSpecText(specs, MANUFACTURER_SPEC_KEYS.description),
    productCount,
  };
}

/** Breadcrumb trail for product detail navigation. */
export function getProductBreadcrumbs(material: Material): BreadcrumbItem[] {
  const manufacturerHref = buildManufacturerBackHref(material);
  const categoryHref = `/search?category=${encodeURIComponent(material.category)}`;

  return [
    { label: "Home", href: "/" },
    { label: material.category, href: categoryHref },
    { label: material.manufacturer, href: manufacturerHref },
    { label: material.name },
  ];
}

/** Link back to Materials browser with manufacturer pre-filtered. */
export function buildManufacturerBackHref(material: Material): string {
  const params = new URLSearchParams();
  params.set("q", material.manufacturer);
  return `/search?${params.toString()}`;
}

/** Visit manufacturer website — product page preferred, else company site. */
export function getManufacturerWebsiteUrl(material: Material): string | undefined {
  if (material.sourceUrl) return material.sourceUrl;
  return getManufacturerProfile(material).website;
}

/** Filters related products from an existing materials list (no new API). */
export function filterRelatedProducts(
  material: Material,
  candidates: MaterialSummary[],
  limit = 6,
): MaterialSummary[] {
  return candidates
    .filter(
      (item) =>
        item.manufacturer === material.manufacturer && item.slug !== material.slug,
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
}
