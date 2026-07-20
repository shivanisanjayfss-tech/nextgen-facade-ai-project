import { ServiceError } from "@/lib/errors";
import { env, isGeminiConfigured } from "@/lib/env";

type GenaiModule = typeof import("@google/genai");

let geminiClient: InstanceType<GenaiModule["GoogleGenAI"]> | null = null;
let genaiModulePromise: Promise<GenaiModule> | null = null;

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

function getGeminiModel(): string {
  return env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
}

async function loadGenaiModule(): Promise<GenaiModule> {
  if (!genaiModulePromise) {
    genaiModulePromise = import("@google/genai");
  }

  return genaiModulePromise;
}

/** Singleton Gemini client for AI comparison and analysis features. */
export async function getGeminiClient() {
  if (!isGeminiConfigured()) return null;

  if (!geminiClient) {
    const { GoogleGenAI } = await loadGenaiModule();
    geminiClient = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }

  return geminiClient;
}

async function requireGeminiClient() {
  const client = await getGeminiClient();
  if (!client) {
    throw new ServiceError(
      "GEMINI_API_KEY is not configured. Add it to .env.local and restart the dev server.",
      "MISSING_API_KEY",
      503,
    );
  }

  return client;
}

function mapGeminiError(error: unknown, ApiError: GenaiModule["ApiError"]): never {
  if (error instanceof ApiError) {
    const message = error.message.toLowerCase();

    if (error.status === 404 || message.includes("not_found") || message.includes("not found")) {
      throw new ServiceError(
        `Gemini model "${getGeminiModel()}" is unavailable for this API key. Set GEMINI_MODEL in .env.local (e.g. gemini-2.0-flash) or check aistudio.google.com.`,
        "MODEL_UNAVAILABLE",
        404,
      );
    }

    if (
      error.status === 401 ||
      error.status === 403 ||
      message.includes("api key") ||
      message.includes("api_key") ||
      message.includes("invalid key") ||
      message.includes("unauthenticated")
    ) {
      throw new ServiceError(
        "Invalid Gemini API key. Check GEMINI_API_KEY in .env.local.",
        "INVALID_API_KEY",
        401,
      );
    }

    if (
      error.status === 429 ||
      message.includes("quota") ||
      message.includes("resource exhausted") ||
      message.includes("rate limit")
    ) {
      const billingIssue =
        message.includes("quota") ||
        message.includes("billing") ||
        message.includes("exceeded");

      if (billingIssue) {
        throw new ServiceError(
          "Gemini quota or billing limit reached. Check usage at aistudio.google.com.",
          "QUOTA_EXCEEDED",
          402,
        );
      }

      throw new ServiceError(
        "Gemini rate limit exceeded. Try again shortly.",
        "RATE_LIMIT",
        429,
      );
    }

    if (message.includes("billing") || message.includes("payment")) {
      throw new ServiceError(
        "Gemini billing issue. Check your account at aistudio.google.com.",
        "BILLING_ERROR",
        403,
      );
    }
  }

  throw error;
}

/** Generates an AI summary comparing facade materials. */
export async function generateComparisonSummary(
  materials: Array<{ name: string; category: string; specs: Record<string, string | undefined> }>,
): Promise<string> {
  const client = await requireGeminiClient();
  const { ApiError } = await loadGenaiModule();
  const model = getGeminiModel();

  const prompt = `You are a facade engineering expert. Material categories include ACP Sheet (aluminium composite panel sheets), Glass, Stone, HPL, Louvers, Metal, Composite, and Other. Compare these materials concisely (3-4 sentences):\n${JSON.stringify(materials, null, 2)}`;

  try {
    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        maxOutputTokens: 300,
        temperature: 0.3,
      },
    });

    const summary = response.text?.trim();
    if (!summary) {
      throw new ServiceError("Gemini returned an empty response.", "AI_EMPTY_RESPONSE", 502);
    }

    return summary;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    mapGeminiError(error, ApiError);
  }
}

/** Lightweight connectivity check for browser/API testing. */
export async function testGeminiConnection(): Promise<{
  ok: true;
  model: string;
  reply: string;
}> {
  const client = await requireGeminiClient();
  const { ApiError } = await loadGenaiModule();
  const model = getGeminiModel();

  try {
    const response = await client.models.generateContent({
      model,
      contents: "Reply with exactly: OK",
      config: {
        maxOutputTokens: 5,
        temperature: 0,
      },
    });

    const reply = response.text?.trim() ?? "";
    return { ok: true, model, reply };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    mapGeminiError(error, ApiError);
  }
}
