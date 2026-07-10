import { apiError, apiSuccess } from "@/lib/api-response";
import { getKnowledgeArticles } from "@/services/knowledge.service";

/** GET /api/knowledge — List all knowledge base articles. */
export async function GET() {
  try {
    const articles = await getKnowledgeArticles();
    return apiSuccess(articles);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch articles";
    return apiError(message, 500, "KNOWLEDGE_ERROR");
  }
}
