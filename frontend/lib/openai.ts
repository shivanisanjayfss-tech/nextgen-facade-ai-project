import OpenAI from "openai";
import { env, isOpenAIConfigured } from "@/lib/env";

let openaiClient: OpenAI | null = null;

/** Singleton OpenAI client for AI comparison and analysis features. */
export function getOpenAIClient(): OpenAI | null {
  if (!isOpenAIConfigured()) return null;

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  return openaiClient;
}

/** Generates an AI summary comparing facade materials. */
export async function generateComparisonSummary(
  materials: Array<{ name: string; category: string; specs: Record<string, string | undefined> }>,
): Promise<string | null> {
  const client = getOpenAIClient();
  if (!client) return null;

  const prompt = `You are a facade engineering expert. Compare these materials concisely (3-4 sentences):\n${JSON.stringify(materials, null, 2)}`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 300,
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content ?? null;
}
