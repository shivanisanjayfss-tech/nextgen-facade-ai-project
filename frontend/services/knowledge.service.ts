import { mapKnowledgeArticleRow } from "@/lib/mappers";
import { MOCK_KNOWLEDGE } from "@/lib/mock-data";
import { getSupabaseServer } from "@/lib/supabase";
import type { KnowledgeArticleRow } from "@/types/database";
import { DB_TABLES } from "@/types/database";
import type { KnowledgeArticle } from "@/types";

/** Fetches all knowledge base articles. */
export async function getKnowledgeArticles(): Promise<KnowledgeArticle[]> {
  const supabase = getSupabaseServer();

  if (supabase) {
    const { data, error } = await supabase
      .from(DB_TABLES.knowledgeArticles)
      .select("*")
      .order("published_at", { ascending: false });

    if (!error && data?.length) {
      return (data as KnowledgeArticleRow[]).map(mapKnowledgeArticleRow);
    }
  }

  return MOCK_KNOWLEDGE;
}

/** Fetches a single knowledge article by slug or ID. */
export async function getKnowledgeArticleBySlug(
  slug: string,
): Promise<KnowledgeArticle | null> {
  const supabase = getSupabaseServer();

  if (supabase) {
    const { data, error } = await supabase
      .from(DB_TABLES.knowledgeArticles)
      .select("*")
      .or(`slug.eq.${slug},id.eq.${slug}`)
      .maybeSingle();

    if (!error && data) return mapKnowledgeArticleRow(data as KnowledgeArticleRow);
  }

  return MOCK_KNOWLEDGE.find((a) => a.slug === slug || a.id === slug) ?? null;
}
