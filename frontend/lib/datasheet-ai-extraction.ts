import { getGeminiClient } from "@/lib/gemini";
import { ServiceError } from "@/lib/errors";
import { env } from "@/lib/env";
import type {
  ConfidentFieldValue,
  DatasheetExtractedFields,
} from "@/types/datasheet-intelligence";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

function getGeminiModel(): string {
  return env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
}

const FIELD_KEYS = [
  "productName",
  "manufacturer",
  "category",
  "thickness",
  "width",
  "length",
  "weight",
  "fireRating",
  "thermalProperties",
  "acousticProperties",
  "finish",
  "coating",
  "materialComposition",
  "warranty",
  "certifications",
  "applications",
  "installationNotes",
  "standards",
] as const;

type RawAiField = {
  value?: string | string[] | null;
  confidence?: number;
  sourcePage?: number | null;
};

type RawAiResponse = {
  fields?: Partial<Record<(typeof FIELD_KEYS)[number], RawAiField>>;
  aiSummary?: string;
  technicalHighlights?: string[];
};

function emptyField(): ConfidentFieldValue<string> {
  return { value: null, confidence: 0 };
}

function emptyArrayField(): ConfidentFieldValue<string[]> {
  return { value: null, confidence: 0 };
}

function setField(
  base: DatasheetExtractedFields,
  key: keyof DatasheetExtractedFields,
  field: ConfidentFieldValue<string | string[]>,
): void {
  (base as unknown as Record<string, ConfidentFieldValue<string | string[]>>)[key] = field;
}

export function createEmptyExtractedFields(): DatasheetExtractedFields {
  return {
    productName: emptyField(),
    manufacturer: emptyField(),
    category: emptyField(),
    thickness: emptyField(),
    width: emptyField(),
    length: emptyField(),
    weight: emptyField(),
    fireRating: emptyField(),
    thermalProperties: emptyField(),
    acousticProperties: emptyField(),
    finish: emptyField(),
    coating: emptyField(),
    materialComposition: emptyField(),
    warranty: emptyField(),
    certifications: emptyArrayField(),
    applications: emptyArrayField(),
    installationNotes: emptyField(),
    standards: emptyArrayField(),
  };
}

function normalizeConfidence(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function normalizeStringField(raw: RawAiField | undefined): ConfidentFieldValue {
  if (!raw) return emptyField();
  const value =
    typeof raw.value === "string" && raw.value.trim().length > 0
      ? raw.value.trim()
      : null;

  return {
    value,
    confidence: normalizeConfidence(raw.confidence),
    sourcePage: typeof raw.sourcePage === "number" ? raw.sourcePage : null,
  };
}

function normalizeArrayField(raw: RawAiField | undefined): ConfidentFieldValue<string[]> {
  if (!raw) return emptyArrayField();

  const values = Array.isArray(raw.value)
    ? raw.value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : typeof raw.value === "string" && raw.value.trim()
      ? [raw.value.trim()]
      : [];

  return {
    value: values.length > 0 ? values : null,
    confidence: normalizeConfidence(raw.confidence),
    sourcePage: typeof raw.sourcePage === "number" ? raw.sourcePage : null,
  };
}

function parseAiJsonResponse(text: string): RawAiResponse {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;

  try {
    return JSON.parse(candidate) as RawAiResponse;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1)) as RawAiResponse;
    }
    throw new ServiceError(
      "Gemini returned invalid JSON for datasheet extraction.",
      "AI_INVALID_JSON",
      502,
    );
  }
}

function mapRawFields(raw: RawAiResponse["fields"]): DatasheetExtractedFields {
  const base = createEmptyExtractedFields();
  if (!raw) return base;

  const arrayKeys = new Set(["certifications", "applications", "standards"]);

  for (const key of FIELD_KEYS) {
    const fieldRaw = raw[key];
    if (arrayKeys.has(key)) {
      setField(base, key, normalizeArrayField(fieldRaw));
    } else {
      setField(base, key, normalizeStringField(fieldRaw));
    }
  }

  return base;
}

export interface DatasheetAiExtractionResult {
  extractedFields: DatasheetExtractedFields;
  aiSummary: string;
  technicalHighlights: string[];
}

/** Uses Gemini to extract structured datasheet fields with confidence scores. */
export async function extractDatasheetIntelligenceWithAi(
  promptText: string,
  context: { materialName: string; manufacturer: string; category: string },
): Promise<DatasheetAiExtractionResult> {
  const client = await getGeminiClient();
  if (!client) {
    throw new ServiceError(
      "GEMINI_API_KEY is not configured. Add it to .env.local to enable datasheet AI extraction.",
      "MISSING_API_KEY",
      503,
    );
  }

  const { ApiError } = await import("@google/genai/node");
  const model = getGeminiModel();

  const prompt = `You are a facade materials technical analyst. Extract structured specifications from the datasheet text below.

Material context:
- Name: ${context.materialName}
- Manufacturer: ${context.manufacturer}
- Category: ${context.category}

Return ONLY valid JSON with this shape:
{
  "fields": {
    "productName": { "value": string|null, "confidence": 0-1, "sourcePage": number|null },
    "manufacturer": { "value": string|null, "confidence": 0-1, "sourcePage": number|null },
    "category": { "value": string|null, "confidence": 0-1, "sourcePage": number|null },
    "thickness": { "value": string|null, "confidence": 0-1, "sourcePage": number|null },
    "width": { "value": string|null, "confidence": 0-1, "sourcePage": number|null },
    "length": { "value": string|null, "confidence": 0-1, "sourcePage": number|null },
    "weight": { "value": string|null, "confidence": 0-1, "sourcePage": number|null },
    "fireRating": { "value": string|null, "confidence": 0-1, "sourcePage": number|null },
    "thermalProperties": { "value": string|null, "confidence": 0-1, "sourcePage": number|null },
    "acousticProperties": { "value": string|null, "confidence": 0-1, "sourcePage": number|null },
    "finish": { "value": string|null, "confidence": 0-1, "sourcePage": number|null },
    "coating": { "value": string|null, "confidence": 0-1, "sourcePage": number|null },
    "materialComposition": { "value": string|null, "confidence": 0-1, "sourcePage": number|null },
    "warranty": { "value": string|null, "confidence": 0-1, "sourcePage": number|null },
    "certifications": { "value": string[]|null, "confidence": 0-1, "sourcePage": number|null },
    "applications": { "value": string[]|null, "confidence": 0-1, "sourcePage": number|null },
    "installationNotes": { "value": string|null, "confidence": 0-1, "sourcePage": number|null },
    "standards": { "value": string[]|null, "confidence": 0-1, "sourcePage": number|null }
  },
  "aiSummary": "2-4 sentence technical summary",
  "technicalHighlights": ["bullet 1", "bullet 2", "bullet 3"]
}

Rules:
- Use null and confidence 0 when a field is not present.
- confidence reflects certainty from explicit datasheet evidence.
- sourcePage references the page marker in the text.
- Keep values concise and engineering-focused.

Datasheet text:
${promptText}`;

  try {
    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        maxOutputTokens: 4096,
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    const text = response.text?.trim();
    if (!text) {
      throw new ServiceError("Gemini returned an empty datasheet extraction.", "AI_EMPTY_RESPONSE", 502);
    }

    const parsed = parseAiJsonResponse(text);
    const extractedFields = mapRawFields(parsed.fields);
    const aiSummary = typeof parsed.aiSummary === "string" ? parsed.aiSummary.trim() : "";
    const technicalHighlights = Array.isArray(parsed.technicalHighlights)
      ? parsed.technicalHighlights
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
      : [];

    if (!aiSummary) {
      throw new ServiceError(
        "Gemini did not return an AI summary for the datasheet.",
        "AI_EMPTY_SUMMARY",
        502,
      );
    }

    return {
      extractedFields,
      aiSummary,
      technicalHighlights,
    };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    if (error instanceof ApiError) {
      throw new ServiceError(error.message, "AI_EXTRACTION_FAILED", 502);
    }
    throw error;
  }
}
