import { apiSuccess } from "@/lib/api-response";
import { testApifyConnection } from "@/lib/apify";

/**
 * GET /api/apify/test
 * Temporary connectivity check — validates token without starting Actor runs.
 */
export async function GET() {
  const result = await testApifyConnection();
  return apiSuccess(result);
}
