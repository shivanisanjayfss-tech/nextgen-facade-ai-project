import OpenAI, {
  APIError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
} from "openai";
import { ServiceError } from "@/lib/errors";
import { env, isOpenAIConfigured } from "@/lib/env";

let openaiClient: OpenAI | null = null;

const OPENAI_MODEL = "gpt-4o-mini";

/** Singleton OpenAI client for AI comparison and analysis features. */
export function getOpenAIClient(): OpenAI | null {
  if (!isOpenAIConfigured()) return null;

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  return openaiClient;
}

function requireOpenAIClient(): OpenAI {
  const client = getOpenAIClient();
  if (!client) {
    throw new ServiceError(
      "OPENAI_API_KEY is not configured. Add it to .env.local and restart the dev server.",
      "MISSING_API_KEY",
      503,
    );
  }

  return client;
}

function mapOpenAIError(error: unknown): never {
  if (error instanceof AuthenticationError) {
    throw new ServiceError(
      "Invalid OpenAI API key. Check OPENAI_API_KEY in .env.local.",
      "INVALID_API_KEY",
      401,
    );
  }

  if (error instanceof RateLimitError) {
    const billingIssue =
      error.code === "insufficient_quota" ||
      error.message.toLowerCase().includes("quota") ||
      error.message.toLowerCase().includes("billing");

    if (billingIssue) {
      throw new ServiceError(
        "OpenAI quota or billing limit reached. Check usage at platform.openai.com.",
        "QUOTA_EXCEEDED",
        402,
      );
    }

    throw new ServiceError(
      "OpenAI rate limit exceeded. Try again shortly.",
      "RATE_LIMIT",
      429,
    );
  }

  if (error instanceof PermissionDeniedError) {
    throw new ServiceError(
      "OpenAI access denied. Verify billing and project permissions.",
      "BILLING_ERROR",
      403,
    );
  }

  if (error instanceof APIError) {
    const message = error.message.toLowerCase();

    if (
      error.status === 402 ||
      message.includes("quota") ||
      message.includes("billing") ||
      message.includes("insufficient")
    ) {
      throw new ServiceError(
        "OpenAI quota or billing issue. Check your account at platform.openai.com.",
        "QUOTA_EXCEEDED",
        402,
      );
    }
  }

  throw error;
}

/** Generates an AI summary comparing facade materials. */
export async function generateComparisonSummary(
  materials: Array<{ name: string; category: string; specs: Record<string, string | undefined> }>,
): Promise<string> {
  const client = requireOpenAIClient();

  const prompt = `You are a facade engineering expert. Compare these materials concisely (3-4 sentences):\n${JSON.stringify(materials, null, 2)}`;

  try {
    const response = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.3,
    });

    const summary = response.choices[0]?.message?.content?.trim();
    if (!summary) {
      throw new ServiceError("OpenAI returned an empty response.", "AI_EMPTY_RESPONSE", 502);
    }

    return summary;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    mapOpenAIError(error);
  }
}

/** Lightweight connectivity check for browser/API testing. */
export async function testOpenAIConnection(): Promise<{
  ok: true;
  model: string;
  reply: string;
}> {
  const client = requireOpenAIClient();

  try {
    const response = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      max_tokens: 5,
      temperature: 0,
    });

    const reply = response.choices[0]?.message?.content?.trim() ?? "";
    return { ok: true, model: OPENAI_MODEL, reply };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    mapOpenAIError(error);
  }
}
