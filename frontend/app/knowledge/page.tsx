import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, PageHeader } from "@/components/layout/PageContainer";
import { ArticleList } from "@/components/knowledge/ArticleCard";
import { createPageMetadata } from "@/lib/seo";
import { getKnowledgeArticles } from "@/services/knowledge.service";

export const metadata = createPageMetadata({
  title: "Knowledge Base",
  description: "Best practices, case studies, and technical guides for facade design.",
  path: "/knowledge",
});

export default async function KnowledgePage() {
  const articles = await getKnowledgeArticles();

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Knowledge Base"
          description="Explore best practices, case studies, and expert guidance."
        />
        <ArticleList articles={articles} />
      </PageContainer>
    </AppLayout>
  );
}
