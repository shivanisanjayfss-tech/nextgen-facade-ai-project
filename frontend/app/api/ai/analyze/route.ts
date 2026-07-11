import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { isServiceError } from "@/lib/errors";
import { isGeminiConfigured } from "@/lib/env";
import { generateComparisonSummary, testGeminiConnection } from "@/lib/gemini";

function logAnalyzeError(action: string, error: unknown, context?: Record<string, unknown>) {
  const details = isServiceError(error)
    ? { code: error.code, status: error.status, message: error.message }
    : { message: error instanceof Error ? error.message : String(error) };

  console.error(`[api/ai/analyze] ${action} failed`, { ...context, ...details, error });
}

function respondWithServiceError(error: unknown) {
  if (isServiceError(error)) {
    return apiError(error.message, error.status, error.code);
  }

  return handleApiError(error);
}

/**
 * GET /api/ai/analyze
 * - Default: config status and usage hints
 * - ?test=true: live Gemini connectivity check
 */
export async function GET(request: NextRequest) {
  const runTest = request.nextUrl.searchParams.get("test") === "true";

  if (!runTest) {
    return apiSuccess({
      endpoint: "/api/ai/analyze",
      configured: isGeminiConfigured(),
      testUrl: "/api/ai/analyze?test=true",
      postExample: {
        materials: [
          {
            name: "Alucobond Plus A2",
            category: "ACP",
            specs: { fireRating: "A2-s1,d0", thickness: "4mm" },
          },
        ],
      },
    });
  }

  try {
    const result = await testGeminiConnection();
    return apiSuccess(result);
  } catch (error) {
    logAnalyzeError("GET test", error);
    return respondWithServiceError(error);
  }
}

/** POST /api/ai/analyze — AI-powered material analysis via Gemini. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const materials = body.materials;

    if (!Array.isArray(materials) || materials.length === 0) {
      return apiError("Materials array is required", 400, "INVALID_REQUEST");
    }

    for (const [index, material] of materials.entries()) {
      if (!material?.name || !material?.category) {
        return apiError(
          `Material at index ${index} must include name and category`,
          400,
          "INVALID_REQUEST",
        );
      }
    }

    const summary = await generateComparisonSummary(materials);
    return apiSuccess({ summary });
  } catch (error) {
    logAnalyzeError("POST analyze", error, { configured: isGeminiConfigured() });
    return respondWithServiceError(error);
  }
}
