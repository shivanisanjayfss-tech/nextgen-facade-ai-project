import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { generateComparisonSummary } from "@/lib/openai";

/** POST /api/ai/analyze — AI-powered material analysis via OpenAI. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const materials = body.materials;

    if (!Array.isArray(materials) || materials.length === 0) {
      return apiError("Materials array is required", 400, "INVALID_REQUEST");
    }

    const summary = await generateComparisonSummary(materials);

    if (!summary) {
      return apiError(
        "AI analysis unavailable. Configure OPENAI_API_KEY.",
        503,
        "AI_UNAVAILABLE",
      );
    }

    return apiSuccess({ summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI analysis failed";
    return apiError(message, 500, "AI_ERROR");
  }
}
