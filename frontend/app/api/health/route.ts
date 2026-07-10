import { apiSuccess, withApiHandler } from "@/lib/api-response";
import {
  isApifyConfigured,
  isN8nConfigured,
  isOpenAIConfigured,
  isSupabaseConfigured,
} from "@/lib/env";

/**
 * GET /api/health
 *
 * Returns service status and which integrations are configured.
 */
export const GET = withApiHandler(async () => {
  return apiSuccess({
    status: "ok",
    service: "nextgen-facade-ai",
    version: "0.1.0",
    integrations: {
      supabase: isSupabaseConfigured(),
      openai: isOpenAIConfigured(),
      apify: isApifyConfigured(),
      n8n: isN8nConfigured(),
    },
    timestamp: new Date().toISOString(),
  });
});
