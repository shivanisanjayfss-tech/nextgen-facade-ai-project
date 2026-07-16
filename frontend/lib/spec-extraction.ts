/**
 * Generic technical-specification extractor for imported manufacturer pages.
 *
 * Parses spec tables, definition lists, markdown tables, and "Label: value"
 * text lines into canonical spec keys that the product detail page renders
 * dynamically. Nothing here is hardcoded to a single category — it works for
 * ACP, glass, stone, HPL, louvers, metal, and any other facade product whose
 * page exposes labelled specification data.
 */

/** Canonical spec key → recognised label aliases (matched case-insensitively). */
const SPEC_FIELD_ALIASES: Record<string, readonly string[]> = {
  thickness: [
    "thickness",
    "panel thickness",
    "total thickness",
    "nominal thickness",
    "sheet thickness",
    "overall thickness",
  ],
  width: [
    "width",
    "widths",
    "standard width",
    "standard widths",
    "production width",
    "production widths",
    "panel width",
    "sheet width",
  ],
  length: [
    "length",
    "lengths",
    "standard length",
    "standard lengths",
    "panel length",
    "sheet length",
  ],
  aluminiumSkinThickness: [
    "aluminium skin thickness",
    "aluminum skin thickness",
    "skin thickness",
    "aluminium thickness",
    "aluminum thickness",
    "cover sheet thickness",
    "cover sheets thickness",
    "aluminium cover sheet",
    "aluminum cover sheet",
    "top sheet thickness",
    "face sheet thickness",
  ],
  coreMaterial: ["core material", "core", "core type", "core composition"],
  fireRating: [
    "fire rating",
    "fire classification",
    "fire class",
    "reaction to fire",
    "fire resistance",
    "fire performance",
    "fire behaviour",
    "fire behavior",
    "euroclass",
    "fire safety",
    "combustibility",
  ],
  surfaceFinish: [
    "surface finish",
    "finish",
    "surface",
    "surface treatment",
    "surface type",
  ],
  coating: [
    "coating",
    "coating type",
    "surface coating",
    "paint system",
    "lacquer",
    "coil coating",
    "coating system",
  ],
  weight: [
    "weight",
    "panel weight",
    "surface weight",
    "areal weight",
    "specific weight",
    "weight per m²",
    "weight per m2",
    "weight per sqm",
  ],
  density: ["density", "bulk density"],
  thermalConductivity: ["thermal conductivity", "lambda", "lambda value"],
  uValue: [
    "u-value",
    "u value",
    "thermal transmittance",
    "ug value",
    "ug-value",
  ],
  visibleLightTransmission: [
    "visible light transmission",
    "light transmission",
    "total light transmission",
    "external light transmission",
    "lt",
    "vlt",
    "direct transmission",
    "visible transmittance",
    "light transmittance",
  ],
  shgc: [
    "shgc",
    "solar heat gain coefficient",
    "solar heat gain",
    "solar heat gain coeff",
  ],
  solarFactor: [
    "solar factor",
    "g-value",
    "g value",
    "total solar energy transmittance",
  ],
  reflectance: [
    "reflectance",
    "light reflectance",
    "external reflection",
    "internal reflection",
    "visible reflectance",
  ],
  glassType: [
    "glass type",
    "type of glass",
    "glass composition",
    "substrate",
    "glass substrate",
    "product family",
  ],
  edgeFinish: [
    "edge finish",
    "edge work",
    "edge treatment",
    "edge deletion",
    "polished edge",
  ],
  acousticRating: [
    "acoustic rating",
    "sound reduction",
    "sound insulation",
    "rw",
    "noise reduction",
    "acoustic performance",
  ],
  availableSizes: [
    "available sizes",
    "standard sizes",
    "sheet sizes",
    "maximum sizes",
    "size range",
    "stock sizes",
    "standard sheet sizes",
  ],
  emissivity: ["emissivity", "normal internal emissivity", "surface emissivity"],
  impactResistance: [
    "impact resistance",
    "impact strength",
    "impact",
    "impact performance",
  ],
  windLoad: [
    "wind load",
    "wind load resistance",
    "wind pressure",
    "wind resistance",
    "wind loading",
  ],
  panelSize: [
    "panel size",
    "panel sizes",
    "sheet size",
    "sheet sizes",
    "format",
    "formats",
    "dimensions",
    "available sizes",
    "standard sizes",
    "standard size",
    "board size",
  ],
  colourOptions: [
    "colour options",
    "color options",
    "colours",
    "colors",
    "colour range",
    "color range",
    "available colours",
    "available colors",
    "standard colours",
    "standard colors",
    "colour",
    "color",
  ],
  glossLevel: [
    "gloss level",
    "gloss",
    "gloss value",
    "degree of gloss",
    "sheen",
    "gloss units",
  ],
  warranty: ["warranty", "guarantee", "warranty period", "guarantee period"],
  certifications: [
    "certifications",
    "certification",
    "certificates",
    "certificate",
    "approvals",
    "approval",
    "standards",
    "compliance",
    "conformity",
    "test standards",
  ],
  applications: [
    "applications",
    "application",
    "application areas",
    "areas of application",
    "fields of application",
    "typical applications",
    "recommended applications",
    "uses",
    "use",
    "suitable for",
    "recommended use",
  ],
};

/** Reverse lookup: normalized alias → canonical key. */
const ALIAS_TO_KEY = new Map<string, string>();
for (const [key, aliases] of Object.entries(SPEC_FIELD_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_TO_KEY.set(normalizeLabel(alias), key);
  }
}

const MAX_LABEL_LENGTH = 48;
const MAX_VALUE_LENGTH = 220;

interface LabelValuePair {
  label: string;
  value: string;
}

/** Lowercases a label and strips units-in-parentheses, tags, and punctuation. */
function normalizeLabel(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[:：*_#•·|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Strips markup/entities and collapses whitespace in a value cell. */
function cleanValue(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    // Unescape markdown backslash-escapes (e.g. "\[kg/m²\]" -> "[kg/m²]").
    .replace(/\\([[\]()*_~`#+\-.!])/g, "$1")
    .replace(/^[\s|*_#•·–—-]+/, "")
    .replace(/[\s|]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when a value looks like usable spec data rather than prose or noise. */
function isUsableValue(label: string, value: string): boolean {
  if (!value) return false;
  if (value.length > MAX_VALUE_LENGTH) return false;
  if (value.toLowerCase() === label.toLowerCase()) return false;
  if (!/[a-z0-9]/i.test(value)) return false;
  // Reject obvious sentences (long multi-clause prose) unless it's a list.
  const words = value.split(/\s+/);
  if (words.length > 24 && !value.includes(",")) return false;
  return true;
}

function pushPair(pairs: LabelValuePair[], rawLabel: string, rawValue: string): void {
  const label = cleanValue(rawLabel);
  const value = cleanValue(rawValue);
  if (!label || label.length > MAX_LABEL_LENGTH) return;
  if (!isUsableValue(label, value)) return;
  pairs.push({ label, value });
}

/** Extracts label/value pairs from HTML `<table>` rows. */
function extractHtmlTablePairs(html: string): LabelValuePair[] {
  const pairs: LabelValuePair[] = [];

  for (const rowMatch of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [
      ...rowMatch[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi),
    ].map((cell) => cell[1]);

    if (cells.length >= 2) {
      pushPair(pairs, cells[0], cells[1]);
    }
  }

  return pairs;
}

/** Extracts label/value pairs from HTML `<dl>` definition lists. */
function extractHtmlDefinitionPairs(html: string): LabelValuePair[] {
  const pairs: LabelValuePair[] = [];

  for (const match of html.matchAll(
    /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi,
  )) {
    pushPair(pairs, match[1], match[2]);
  }

  return pairs;
}

/** Extracts label/value pairs from markdown / plaintext tables and colon lines. */
function extractTextPairs(text: string): LabelValuePair[] {
  const pairs: LabelValuePair[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // Markdown / ASCII table row: | Label | Value |
    if (line.includes("|")) {
      if (/^\|?[\s|:-]+\|?$/.test(line)) continue; // separator row
      const columns = line
        .split("|")
        .map((column) => column.trim())
        .filter((column) => column.length > 0);
      if (columns.length >= 2) {
        pushPair(pairs, columns[0], columns.slice(1).join(", "));
        continue;
      }
    }

    // "Label: value" line, optionally prefixed by a bullet marker.
    const colonMatch = line.match(/^[-*•·]?\s*([^:：]{2,48})[:：]\s+(.+)$/);
    if (colonMatch) {
      pushPair(pairs, colonMatch[1], colonMatch[2]);
    }
  }

  return pairs;
}

/**
 * Extracts canonical technical specifications from a crawled product page.
 * Returns a map of spec key → value. First match per key wins so that
 * higher-quality structured data (tables) takes precedence over loose text.
 */
export function extractTechnicalSpecs(
  text: string,
  html = "",
): Record<string, string> {
  const specs: Record<string, string> = {};

  const orderedPairs: LabelValuePair[] = [
    ...extractHtmlTablePairs(html),
    ...extractHtmlDefinitionPairs(html),
    ...extractTextPairs(text),
  ];

  for (const { label, value } of orderedPairs) {
    const key = ALIAS_TO_KEY.get(normalizeLabel(label));
    if (!key) continue;
    if (specs[key] !== undefined) continue; // first (highest-priority) wins
    specs[key] = value;
  }

  return specs;
}

/* -------------------------------------------------------------------------- */
/* Heading-based list extraction (features, applications, benefits)           */
/* -------------------------------------------------------------------------- */

/** Section headings that introduce a product feature / benefit list. */
export const FEATURE_HEADING_ALIASES: readonly string[] = [
  "features",
  "key features",
  "product features",
  "main features",
  "benefits",
  "key benefits",
  "product benefits",
  "your benefits",
  "advantages",
  "product advantages",
  "highlights",
  "product highlights",
  "characteristics",
  "properties",
  "product properties",
];

/** Section headings that introduce an applications / uses list. */
export const APPLICATION_HEADING_ALIASES: readonly string[] = [
  "applications",
  "application",
  "application areas",
  "areas of application",
  "fields of application",
  "field of application",
  "typical applications",
  "recommended applications",
  "possible applications",
  "applications include",
  "application include",
  "uses",
  "use cases",
  "suitable for",
  "where to use",
];

/** Section headings that introduce certifications / standards lists. */
export const CERTIFICATION_HEADING_ALIASES: readonly string[] = [
  "certifications",
  "certification",
  "certificates",
  "certificate",
  "approvals",
  "approval",
  "standards",
  "compliance",
  "conformity",
  "test standards",
  "product certification",
  "certified to",
];

const MAX_LIST_ITEMS = 12;
const MIN_LIST_ITEM_LENGTH = 3;
const MAX_LIST_ITEM_LENGTH = 180;

/** Returns the heading text when a line is a markdown heading, bold-only, or a short "Title:" line. */
function getHeadingText(line: string): string | null {
  const atx = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
  if (atx) return atx[1];

  const bold = line.match(/^\*\*(.+?)\*\*:?$/);
  if (bold) return bold[1];

  const titled = line.match(/^([A-Za-z][A-Za-z /&-]{1,46}):$/);
  if (titled) return titled[1];

  return null;
}

/** Strips markdown links, emphasis, and markup from a bullet list item. */
function cleanListItem(raw: string): string {
  return raw
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_`]+/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts a bullet list that follows a heading matching one of `aliases`.
 * Works for markdown / plaintext content. Nothing is hardcoded to a category —
 * it simply reads whichever list the manufacturer page exposes under a matching
 * heading (Features, Benefits, Applications, etc.). Returns [] when no list is found.
 */
export function extractSectionList(
  text: string,
  aliases: readonly string[],
): string[] {
  const normalizedAliases = new Set(aliases.map((alias) => normalizeLabel(alias)));
  const items: string[] = [];
  const seen = new Set<string>();

  let capturing = false;
  let sawBullet = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const heading = getHeadingText(line);

    if (heading !== null) {
      if (normalizedAliases.has(normalizeLabel(heading))) {
        capturing = true;
        sawBullet = false;
      } else if (capturing) {
        // A different heading closes the current section.
        break;
      }
      continue;
    }

    if (!capturing) continue;

    if (!line) {
      // A blank line after collecting bullets ends the list.
      if (sawBullet) break;
      continue;
    }

    const bullet = line.match(/^(?:[-*•·–—]|\d+[.)])\s+(.+)$/);
    if (bullet) {
      sawBullet = true;
      const cleaned = cleanListItem(bullet[1]);
      const key = cleaned.toLowerCase();
      if (
        cleaned.length >= MIN_LIST_ITEM_LENGTH &&
        cleaned.length <= MAX_LIST_ITEM_LENGTH &&
        /[a-z0-9]/i.test(cleaned) &&
        !seen.has(key)
      ) {
        seen.add(key);
        items.push(cleaned);
        if (items.length >= MAX_LIST_ITEMS) break;
      }
      continue;
    }

    // Non-bullet content: end the list once bullets have started; otherwise
    // (an intro sentence between heading and list) bail to avoid capturing prose.
    break;
  }

  return items;
}

function headingMatchesAlias(heading: string, aliases: readonly string[]): boolean {
  const normalizedHeading = normalizeLabel(heading);
  const normalizedAliases = aliases.map((alias) => normalizeLabel(alias));

  return normalizedAliases.some(
    (alias) =>
      normalizedHeading === alias ||
      normalizedHeading.includes(alias) ||
      alias.includes(normalizedHeading),
  );
}

function extractHtmlListItems(listHtml: string): string[] {
  const items: string[] = [];
  const seen = new Set<string>();

  for (const match of listHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    const cleaned = cleanListItem(match[1]);
    const key = cleaned.toLowerCase();
    if (
      cleaned.length >= MIN_LIST_ITEM_LENGTH &&
      cleaned.length <= MAX_LIST_ITEM_LENGTH &&
      /[a-z0-9]/i.test(cleaned) &&
      !seen.has(key)
    ) {
      seen.add(key);
      items.push(cleaned);
      if (items.length >= MAX_LIST_ITEMS) break;
    }
  }

  return items;
}

/**
 * Extracts bullet lists that follow HTML headings matching one of `aliases`.
 * Complements markdown extraction for manufacturer sites that render specs in HTML.
 */
export function extractHtmlSectionList(
  html: string,
  aliases: readonly string[],
): string[] {
  if (!html.trim()) return [];

  const items: string[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(
    /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>([\s\S]*?)(?=<h[1-6][^>]*>|$)/gi,
  )) {
    const heading = cleanValue(match[1]);
    if (!headingMatchesAlias(heading, aliases)) continue;

    const sectionHtml = match[2] ?? "";
    const listMatch = sectionHtml.match(/<(ul|ol)[^>]*>([\s\S]*?)<\/\1>/i);
    if (!listMatch) continue;

    for (const item of extractHtmlListItems(listMatch[2])) {
      const key = item.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
      if (items.length >= MAX_LIST_ITEMS) break;
    }

    if (items.length > 0) break;
  }

  return items;
}

/** Extracts a section list from markdown/plaintext and HTML page content. */
export function extractSectionListFromContent(
  text: string,
  html: string,
  aliases: readonly string[],
): string[] {
  const fromText = extractSectionList(text, aliases);
  if (fromText.length > 0) return fromText;
  return extractHtmlSectionList(html, aliases);
}

/** Extracts a product feature / benefit list from crawled page content. */
export function extractFeatureList(text: string, html = ""): string[] {
  return extractSectionListFromContent(text, html, FEATURE_HEADING_ALIASES);
}

/** Extracts a product applications / uses list from crawled page content. */
export function extractApplicationList(text: string, html = ""): string[] {
  return extractSectionListFromContent(text, html, APPLICATION_HEADING_ALIASES);
}

/** Extracts certifications / standards lists from crawled page content. */
export function extractCertificationList(text: string, html = ""): string[] {
  return extractSectionListFromContent(text, html, CERTIFICATION_HEADING_ALIASES);
}
